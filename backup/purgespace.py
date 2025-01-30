import json

def process_jsonl_file(file_path):
    # Read the input file
    with open(file_path, 'r', encoding='utf-8') as infile:
        lines = infile.readlines()

    # Process each line
    updated_lines = []
    for line in lines:
        try:
            # Parse the JSON object
            data = json.loads(line)
            
            # Check and update the "book_title" key
            if "book_title" in data and data["book_title"] == " The Human Cycle":
                data["book_title"] = "The Human Cycle"
            
            # Convert the updated object back to a JSON string
            updated_line = json.dumps(data)
            updated_lines.append(updated_line)
        except json.JSONDecodeError:
            print(f"Error decoding JSON: {line}")
            continue

    # Write the updated lines back to the file
    with open(file_path, 'w', encoding='utf-8') as outfile:
        for updated_line in updated_lines:
            outfile.write(updated_line + '\n')

if __name__ == "__main__":
    file_path = "/home/olier/oliertrial/dataset/merged_auromira.jsonl"
    process_jsonl_file(file_path)
    print("Processing complete.")