#!/usr/bin/env python3

import os
import sys
import json

def main():
    # Paths
    input_filepath = "/home/olier/Olierdev/merged_auromira_embed.jsonl"
    output_sri_aurobindo = "/home/olier/Olierdev/merged_sri_aurobindo_embed.jsonl"
    output_the_mother = "/home/olier/Olierdev/merged_the_mother_embed.jsonl"

    # 1. Check input file
    if not os.path.exists(input_filepath):
        print(f"Error: input file does not exist: {input_filepath}")
        sys.exit(1)

    # 2. Open output files
    #    We'll open them in 'w' mode to overwrite if they exist
    try:
        f_sri = open(output_sri_aurobindo, "w", encoding="utf-8")
        f_mother = open(output_the_mother, "w", encoding="utf-8")
    except OSError as e:
        print(f"Error opening output files: {e}")
        sys.exit(1)

    # 3. Process the input file
    lines_processed = 0
    lines_sri = 0
    lines_mother = 0
    skipped = 0

    with open(input_filepath, "r", encoding="utf-8") as infile:
        for line_number, line in enumerate(infile, 1):
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"Skipping line {line_number}: JSON decode error: {e}")
                skipped += 1
                continue

            # Must have "author" key
            author = record.get("author", "").strip()
            if not author:
                print(f"Skipping line {line_number}: 'author' field missing or empty.")
                skipped += 1
                continue

            # Decide which file to write to based on the author
            if author == "Sri Aurobindo":
                f_sri.write(json.dumps(record, ensure_ascii=False) + "\n")
                lines_sri += 1
            elif author == "The Mother":
                f_mother.write(json.dumps(record, ensure_ascii=False) + "\n")
                lines_mother += 1
            else:
                # If there's an unexpected author, we skip or handle differently
                print(f"Skipping line {line_number}: Unrecognized author '{author}'")
                skipped += 1

            lines_processed += 1

    # 4. Clean up
    f_sri.close()
    f_mother.close()

    print(f"Done. Processed {lines_processed} lines.")
    print(f"  => {lines_sri} lines for Sri Aurobindo in '{output_sri_aurobindo}'")
    print(f"  => {lines_mother} lines for The Mother in '{output_the_mother}'")
    print(f"Skipped: {skipped} lines (no recognized author or invalid JSON).")

if __name__ == "__main__":
    main()
