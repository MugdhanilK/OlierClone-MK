import os
import json
import numpy as np
import toml
import sys
import hashlib
from collections import Counter
from qdrant_client import QdrantClient
from qdrant_client.models import Batch, VectorParams, Distance

secrets = toml.load('/home/olier/DataGenResearch/Datagen/secrets.toml')

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    print("QDRANT_URL or QDRANT_API_KEY environment variables not set.")
    sys.exit(1)

# Initialize Qdrant client with a longer timeout if needed
qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    timeout=60.0
)


def load_and_process_jsonl(filepath):
    data = []
    all_ids = []
    long_ids = []
    with open(filepath, 'r') as f:
        for line_number, line in enumerate(f, 1):
            try:
                record = json.loads(line)
                if 'search_id' not in record:
                    raise KeyError(f"'search_id' not found in record at line {line_number}")
                
                id_value = record['search_id']
                if len(id_value) > 36:
                    long_ids.append((line_number, id_value))
                
                data_item = {
                    "text": record["text"],
                    "ID": id_value,
                    "embedding": record["embedding"],
                    "line_number": line_number
                }
                data.append(data_item)
                all_ids.append(id_value)
            except json.JSONDecodeError:
                print(f"Error decoding JSON at line {line_number}. Skipping this line.")
            except KeyError as e:
                print(f"Error processing record at line {line_number}: {e}")
    return data, long_ids, all_ids

def check_unique_ids(all_ids):
    id_counts = Counter(all_ids)
    duplicate_ids = {id_val: count for id_val, count in id_counts.items() if count > 1}
    return duplicate_ids

def string_to_int_id(string_id):
    hash_val = hashlib.md5(string_id.encode('utf-8')).hexdigest()
    int_id = int(hash_val, 16) % (2**63 - 1)
    return int_id

def batch_upsert(qdrant_client, collection_name, ids, vectors, payloads, batch_size=1000):
    total = len(ids)
    for start in range(0, total, batch_size):
        end = start + batch_size
        batch_ids = ids[start:end]
        batch_vectors = vectors[start:end]
        batch_payloads = payloads[start:end]
        
        qdrant_client.upsert(
            collection_name=collection_name,
            points=Batch(
                ids=batch_ids,
                vectors=batch_vectors,
                payloads=batch_payloads
            )
        )
        print(f"Uploaded {end if end < total else total} of {total} records to {collection_name}...")

def process_dataset(input_filepath, dataset_identifier):
    # Load and process data
    data, long_ids, all_ids = load_and_process_jsonl(input_filepath)

    # Check for duplicate or long IDs
    duplicate_ids = check_unique_ids(all_ids)

    error_filepath = '/home/olier/DataGenResearch/Datagen/Sources/AuroMira/JSON/nomicid_errors.txt'
    invalid_entries = []
    if long_ids or duplicate_ids:
        with open(error_filepath, 'w') as error_file:
            if long_ids:
                error_file.write("IDs longer than 36 characters:\n")
                for line_number, id_value in long_ids:
                    error_file.write(f"Line {line_number}: {id_value}\n")
                error_file.write("\n")
            
            if duplicate_ids:
                error_file.write("Duplicate IDs:\n")
                for id_value, count in duplicate_ids.items():
                    error_file.write(f"ID: {id_value}, Count: {count}\n")
        
        print(f"Errors found. Check {error_filepath} for details.")
        sys.exit(1)

    print(f"Processed {len(data)} records successfully for dataset '{dataset_identifier}'.")

    # Validate and convert embeddings to floats
    valid_data = []
    for item in data:
        emb = item["embedding"]

        if not isinstance(emb, list):
            invalid_entries.append((item["line_number"], item["ID"], "Embedding is not a list"))
            continue

        try:
            # Attempt to convert all elements to float
            clean_emb = [float(str(v).strip()) for v in emb]
            # If successful, update the embedding
            item["embedding"] = clean_emb
            valid_data.append(item)
        except ValueError as e:
            # If conversion fails, log the entry
            invalid_entries.append((item["line_number"], item["ID"], f"Non-numeric embedding value: {e}"))

    # If there are invalid entries, log them to the error file
    if invalid_entries:
        with open(error_filepath, 'a') as error_file:
            error_file.write("Invalid embedding entries:\n")
            for line_number, id_value, reason in invalid_entries:
                error_file.write(f"Line {line_number}, ID {id_value}, Reason: {reason}\n")

        # We continue without these invalid entries, they are simply purged
        print(f"Some entries had invalid embeddings and were purged. Check {error_filepath} for details.")

    # Proceed only with valid_data
    if not valid_data:
        print("No valid entries remain after purging invalid embeddings.")
        return

    int_ids = [string_to_int_id(item["ID"]) for item in valid_data]
    vectors = [item["embedding"] for item in valid_data]
    payloads = [{"original_id": item["ID"], "text": item["text"]} for item in valid_data]

    collection_name = dataset_identifier
    collections_response = qdrant_client.get_collections()
    existing_collections = [c.name for c in collections_response.collections]

    if collection_name not in existing_collections and vectors:
        vector_size = len(vectors[0])
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE
            )
        )

    # Batch upload the points to avoid timeout
    if vectors:
        batch_upsert(qdrant_client, collection_name, int_ids, vectors, payloads, batch_size=1000)
        print(f"Dataset '{dataset_identifier}' uploaded to Qdrant successfully!")
    else:
        print(f"No valid vectors to upload for dataset '{dataset_identifier}'.")


def main():
    dataset_identifier1 = 'aurocoherecomplete'
    dataset_identifier2 = 'mothercoherecomplete'

    input_filepath1 = '/home/olier/Olierdev/merged_sri_aurobindo_embed.jsonl'
    input_filepath2 = '/home/olier/Olierdev/merged_the_mother_embed.jsonl'

    process_dataset(input_filepath1, dataset_identifier1)
    process_dataset(input_filepath2, dataset_identifier2)

if __name__ == "__main__":
    main()
