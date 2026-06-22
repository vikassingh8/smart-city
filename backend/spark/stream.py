"""
Smart City - Stream Processing with Apache Spark Structured Streaming.

Reads raw IoT readings from the Kafka topic `sensor-data`, performs real-time
FILTERING / ENRICHMENT (derives an alert level per reading), and writes the
enriched records to the Kafka topic `processed-data`.

Run (inside the spark container):
    spark-submit \
      --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1 \
      /app/stream.py
"""
import os

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, to_json, struct, when, date_format, current_timestamp,
)
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType, IntegerType,
)

BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP", "kafka:9092")
TOPIC_IN = os.environ.get("TOPIC_RAW", "sensor-data")
TOPIC_OUT = os.environ.get("TOPIC_PROCESSED", "processed-data")

spark = (
    SparkSession.builder.appName("SmartCityProcessor").getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")

# Schema of the raw sensor messages produced by the ingestion service.
schema = StructType([
    StructField("sensorId", StringType()),
    StructField("temperature", DoubleType()),
    StructField("humidity", IntegerType()),
    StructField("airQuality", IntegerType()),
    StructField("noise", IntegerType()),
    StructField("timestamp", StringType()),
])

# 1) Read the raw stream from Kafka.
raw = (
    spark.readStream.format("kafka")
    .option("kafka.bootstrap.servers", BOOTSTRAP)
    .option("subscribe", TOPIC_IN)
    .option("startingOffsets", "latest")
    .load()
)

# 2) Parse the JSON payload into typed columns.
parsed = raw.select(
    from_json(col("value").cast("string"), schema).alias("d")
).select("d.*")

# 3) Enrich: derive an alert level (filtering / transformation).
enriched = parsed.withColumn(
    "alert",
    when(col("airQuality") > 200, "HIGH POLLUTION")
    .when(col("airQuality") > 100, "MODERATE POLLUTION")
    .when(col("temperature") > 38, "HEAT WARNING")
    .when(col("noise") > 90, "NOISE WARNING")
    .otherwise("NORMAL"),
).withColumn(
    "processedAt", date_format(current_timestamp(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
)

# 4) Re-serialise to JSON and write back to Kafka (keyed by sensorId).
out = enriched.select(
    col("sensorId").cast("string").alias("key"),
    to_json(
        struct(
            "sensorId", "temperature", "humidity", "airQuality",
            "noise", "alert", "timestamp", "processedAt",
        )
    ).alias("value"),
)

query = (
    out.writeStream.format("kafka")
    .option("kafka.bootstrap.servers", BOOTSTRAP)
    .option("topic", TOPIC_OUT)
    .option("checkpointLocation", "/tmp/spark-checkpoint")
    .outputMode("append")
    .start()
)

print(f"Spark streaming {TOPIC_IN} -> {TOPIC_OUT} via {BOOTSTRAP}")
query.awaitTermination()
