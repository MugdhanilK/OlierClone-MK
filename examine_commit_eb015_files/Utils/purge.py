import os
from bs4 import BeautifulSoup

# Directory containing your HTML files
HTML_DIRECTORY = "/home/olier/Olierdev/www/static/HTML"

def remove_all_search_ids_in_directory(directory):
    for filename in os.listdir(directory):
        if filename.lower().endswith(".html"):
            file_path = os.path.join(directory, filename)
            
            # Make sure it's a file (not a subdirectory)
            if not os.path.isfile(file_path):
                continue

            with open(file_path, "r", encoding="utf-8") as f:
                soup = BeautifulSoup(f, "html.parser")
            
            # Remove 'search_id' from all tags that have it
            for tag in soup.find_all():
                if tag.has_attr("search_id"):
                    del tag["search_id"]

            # Write the cleaned HTML back to file
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(str(soup))

            print(f"Purged search_id attributes in: {filename}")

def main():
    remove_all_search_ids_in_directory(HTML_DIRECTORY)

if __name__ == "__main__":
    main()
