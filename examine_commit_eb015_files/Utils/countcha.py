import os
from bs4 import BeautifulSoup, Comment

INPUT_FOLDER = "/home/olier/Olierdev/www/static/HTML"
OUTPUT_FOLDER = "/home/olier/Olierdev/www/static/HTML/Pgadjust"
SPECIAL_COMMENT_TEXT = "End of Introductory Section"
SHORT_LENGTH_THRESHOLD = 50

def find_next_significant_tag(current_tag):
    """
    Move to the next sibling in the source order, skipping over
    text nodes, empty strings, or purely whitespace.
    Return the next 'tag' (BeautifulSoup element) or None if none is found.
    """
    sibling = current_tag.next_sibling
    while sibling:
        # If it's a NavigableString or empty, keep going
        if not getattr(sibling, "name", None):
            sibling = sibling.next_sibling
            continue
        # Once we find an actual Tag, return it
        return sibling
    return None

def process_html_file(input_path, output_path):
    """
    Parse a single .html file and:
      1) Convert single-character <p> to <p class="sec-br">.
      2) Apply sub-hd logic.
      3) Apply <p class="P"> logic before/after anchor comment.
      4) *Remove only the <div class="fns"> wrapper*, but keep footnote <p> tags inside.
    """
    with open(input_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    # Find the special comment node in the document
    anchor_node = soup.find(
        string=lambda text: isinstance(text, Comment) and SPECIAL_COMMENT_TEXT in text
    )
    anchor_encountered = False

    # --- Traverse the DOM for main logic
    for element in soup.recursiveChildGenerator():
        
        # (A) Check if this element is the special comment
        if isinstance(element, Comment) and SPECIAL_COMMENT_TEXT in element:
            anchor_encountered = True
            continue

        # (B) We only care about <p> tags with class attributes
        if element.name == "p" and element.has_attr("class"):
            text_content = element.get_text(strip=True)

            # 1) Broad single-character check => <p class="sec-br">
            if len(text_content) == 1:
                element["class"] = ["sec-br"]
                continue

            # 2) <p class="sub-hd"> logic
            if "sub-hd" in element["class"]:
                # ... any special sub-hd logic if needed ...
                continue

            # 3) <p class="P"> logic before/after anchor
            if "P" in element["class"]:
                # Before the anchor => Pi
                if not anchor_encountered:
                    element["class"] = ["Pi"]
                else:
                    # After anchor => check text length
                    if len(text_content) >= SHORT_LENGTH_THRESHOLD:
                        element["class"] = ["P"]
                    else:
                        # < 200 chars => might become Ps, unless next is p-num or footnote
                        next_tag = find_next_significant_tag(element)
                        if next_tag and next_tag.name == "p" and next_tag.has_attr("class"):
                            next_classes = next_tag["class"]
                            if "p-num" in next_classes or "footnote" in next_classes:
                                element["class"] = ["P"]
                            else:
                                element["class"] = ["Ps"]
                        elif next_tag and next_tag.name == "div" and "fns" in next_tag.get("class", []):
                            element["class"] = ["P"]
                        else:
                            element["class"] = ["Ps"]

    # --- Now remove only the <div class="fns"> wrappers, leaving footnote <p> tags
    for fns_div in soup.find_all("div", class_="fns"):
        # .unwrap() removes the <div> but keeps its children intact
        fns_div.unwrap()

    # --- Finally, write the modified HTML
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(str(soup))

def main():
    # Ensure output folder exists
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    # Loop through files in INPUT_FOLDER, ignoring subdirectories
    for filename in os.listdir(INPUT_FOLDER):
        if not filename.lower().endswith(".html"):
            continue  # Skip non-HTML files

        input_file = os.path.join(INPUT_FOLDER, filename)

        # Make sure it's a file and not a directory
        if not os.path.isfile(input_file):
            continue

        output_file = os.path.join(OUTPUT_FOLDER, filename)
        process_html_file(input_file, output_file)
        print(f"Processed: {filename} -> {output_file}")

if __name__ == "__main__":
    main()
