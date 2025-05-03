import json

def extract_samples(input_file, output_file, num_samples=10):
    count = 0
    with open(input_file, 'r', encoding='utf-8') as fin, open(output_file, 'w', encoding='utf-8') as fout:
        for line in fin:
            if count >= num_samples:
                break
            try:
                record = json.loads(line)
                # Optionally verify the record contains what you expect
                # or transform it if needed.
                fout.write(json.dumps(record) + '\n')
                count += 1
            except json.JSONDecodeError:
                # If a line isn't valid JSON, skip it
                continue
    print(f"Extracted {count} samples to {output_file}")

if __name__ == "__main__":
    # Replace these paths with your actual file paths
    input_file = '/home/olier/DataGenResearch/Datagen/Sources/AuroMira/JSON/merged_the_mother_embed.jsonl'
    output_file = 'sample_output.jsonl'
    extract_samples(input_file, output_file, num_samples=10)
