#!/usr/bin/env python3

import os
import json
import sys
import cohere

def chunkify(lst, chunk_size):
    """Yield successive chunk_size chunks from lst."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]

def main():
    # Paths
    input_filepath = "/home/olier/Olierdev/merged_auromira.jsonl"
    output_filepath = "/home/olier/Olierdev/merged_auromira_embed.jsonl"

    # 1. Get Cohere API key from environment
    cohere_api_key = os.environ.get("COHERE_API_KEY")
    if not cohere_api_key:
        print("Error: COHERE_API_KEY environment variable not set.")
        sys.exit(1)

    # 2. Initialize the Cohere v2 client
    co = cohere.ClientV2(api_key=cohere_api_key)

    # 3. Read the JSONL input
    if not os.path.exists(input_filepath):
        print(f"Input file does not exist: {input_filepath}")
        sys.exit(1)

    records = []
    with open(input_filepath, "r", encoding="utf-8") as infile:
        for line_number, line in enumerate(infile, 1):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                # We expect "text" and "search_id" at minimum
                if "text" not in record or "search_id" not in record:
                    print(f"Skipping line {line_number}: Missing 'text' or 'search_id'.")
                    continue
                records.append(record)
            except json.JSONDecodeError as e:
                print(f"Skipping line {line_number} due to JSON parse error: {e}")

    if not records:
        print("No valid records found in the input file.")
        sys.exit(1)

    # 4. Generate embeddings in batches
    batch_size = 50
    embedded_count = 0

    print(f"Total records to embed: {len(records)}")
    embedded_records = []

    for chunk in chunkify(records, batch_size):
        texts = [r["text"] for r in chunk]

        # Call co.embed for the chunk
        response = co.embed(
            model="embed-english-v3.0",
            input_type="search_document",
            texts=texts,
            embedding_types=["float"],
        )

        # response.embeddings is a dict with one key "float"
        float_embeddings = response.embeddings.float

        # Attach embeddings to the records
        for rec, emb in zip(chunk, float_embeddings):
            rec["embedding"] = emb  # Already a list of floats
            embedded_records.append(rec)

        embedded_count += len(chunk)
        print(f"Embedded {embedded_count} of {len(records)} records...")

    # 5. Write out the new JSONL file with embeddings
    with open(output_filepath, "w", encoding="utf-8") as outfile:
        for record in embedded_records:
            outfile.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Successfully written {len(embedded_records)} embedded records to {output_filepath}")

if __name__ == "__main__":
    main()
