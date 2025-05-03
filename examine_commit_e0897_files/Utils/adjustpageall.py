import os
import re
from bs4 import BeautifulSoup

input_dir = "/home/olier/Olierdev/www/static/HTML_backup"
output_dir = "/home/olier/Olierdev/www/static/HTML/Pgadjust"

# Ensure output directory exists
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 1) Files that have no <p class="p-num">
no_pnum_files = []
# 2) Dictionary of files with page-number problems: filename -> list of issue strings
problem_files = {}

def process_file(input_file, output_file):
    """
    Processes a single HTML file according to the logic:
      1. Remove <span id="page_X">.
      2. Identify anchors (p-num) and pg-num paragraphs.
      3. Handle three scenarios:
         a) No anchors
         b) Single anchor
         c) Multiple anchors
      4. For multiple anchors, insert missing pages between anchor pairs.
      5. After the final anchor, simply convert any remaining pg-num to p-num
         using a running expected_page (no blank pages inserted here).
      6. Perform a final check to see if pages end up out-of-order or duplicated.
    """
    with open(input_file, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "lxml")

    # 1) Remove all <span id="page_X"> elements
    for span in soup.find_all("span", id=re.compile(r'page_\d+')):
        span.decompose()

    # Collect all p-num and pg-num in the order they appear.
    all_paragraphs = soup.find_all("p", class_=re.compile("p-num|pg-num"))

    # Identify anchors (p-num) and their page numbers
    anchors = []
    for p in all_paragraphs:
        text = p.get_text(strip=True)
        m = re.search(r'Page\s+(\d+)', text, re.IGNORECASE)
        if m and "p-num" in p.get("class", []):
            anchors.append((int(m.group(1)), p))

    # --------------------
    # SCENARIO A: No anchors
    # --------------------
    if len(anchors) == 0:
        # Record that this file has no anchor pages
        no_pnum_files.append(os.path.basename(input_file))

        # Convert all pg-num to p-num (class only, no renumbering)
        for p in all_paragraphs:
            if "pg-num" in p.get("class", []):
                p["class"] = ["p-num"]

        # Write out and return
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(str(soup))
        return

    # --------------------
    # SCENARIO B: Single anchor
    # --------------------
    # Convert all subsequent <p class="pg-num"> in ascending order from that anchor page + 1
    if len(anchors) == 1:
        anchor_page, anchor_tag = anchors[0]
        expected_page = anchor_page + 1

        # Traverse everything after the single anchor
        current = anchor_tag.next_sibling
        while current:
            if current.name == "p" and "pg-num" in current.get("class", []):
                current["class"] = ["p-num"]
                current.string = f"Page {expected_page}"
                expected_page += 1
            current = current.next_sibling

        # Write the result
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(str(soup))

        # Check for numbering issues
        check_numbering_for_problems(soup, os.path.basename(input_file))
        return

    # --------------------
    # SCENARIO C: Multiple anchors
    # --------------------
    def get_page_num(tag):
        text = tag.get_text(strip=True)
        m = re.search(r'Page\s+(\d+)', text, re.IGNORECASE)
        return int(m.group(1)) if m else None

    # Process each pair of consecutive anchors
    for i in range(len(anchors) - 1):
        start_page, start_anchor_tag = anchors[i]
        end_page, end_anchor_tag   = anchors[i + 1]

        # Gather all elements between start_anchor and end_anchor
        segment_elems = []
        current = start_anchor_tag.next_sibling
        while current and current != end_anchor_tag:
            if current.name is not None:
                segment_elems.append(current)
            current = current.next_sibling

        expected_page = start_page + 1

        # Convert or insert missing pages between these two anchors
        for elem in segment_elems:
            if elem.has_attr("class") and "pg-num" in elem["class"]:
                pg_num = get_page_num(elem)

                # Insert missing pages before this pg-num if needed
                while expected_page < pg_num:
                    new_pnum = soup.new_tag("p", **{"class": "p-num"})
                    new_pnum.string = f"Page {expected_page}"
                    elem.insert_before(new_pnum)

                    blank_p = soup.new_tag("p", **{"class": "blank"})
                    blank_p.string = "[Blank]"
                    elem.insert_before(blank_p)

                    expected_page += 1

                # Convert this pg-num to p-num for the next expected_page
                elem["class"] = ["p-num"]
                elem.string = f"Page {expected_page}"
                expected_page += 1

        # After processing all pg-num in this segment,
        # if we still have pages before end_page, insert them (with blanks)
        while expected_page < end_page:
            new_pnum = soup.new_tag("p", **{"class":"p-num"})
            new_pnum.string = f"Page {expected_page}"
            end_anchor_tag.insert_before(new_pnum)

            blank_p = soup.new_tag("p", **{"class":"blank"})
            blank_p.string = "[Blank]"
            end_anchor_tag.insert_before(blank_p)

            expected_page += 1

    # 3) Handle the "final anchor" scenario
    #    Convert any remaining <p class="pg-num"> after the last anchor 
    #    into <p class="p-num"> with an increasing expected_page
    last_anchor_page, last_anchor_tag = anchors[-1]
    expected_page = last_anchor_page + 1

    # Traverse from the last anchor tag to the end of the document
    tail_node = last_anchor_tag.next_sibling
    while tail_node:
        if tail_node.name == "p" and "pg-num" in tail_node.get("class", []):
            tail_node["class"] = ["p-num"]
            tail_node.string = f"Page {expected_page}"
            expected_page += 1
        tail_node = tail_node.next_sibling

    # Finally, write out the transformed HTML
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(str(soup))

    # Check for repeated or out-of-order pages
    check_numbering_for_problems(soup, os.path.basename(input_file))


def check_numbering_for_problems(soup, filename):
    """
    After the transformation, gather all <p class="p-num"> in order,
    parse their page numbers, and see if there's any out-of-order or duplicates.
    We store them in problem_files[filename] as strings describing each issue.
    If no issues are found, we remove filename from the dictionary.
    """
    # Initialize an empty list of problems for this file
    problem_files[filename] = []
    
    pnum_tags = soup.find_all("p", class_="p-num")
    last_page = None
    for tag in pnum_tags:
        text = tag.get_text(strip=True)
        m = re.search(r'Page\s+(\d+)', text, re.IGNORECASE)
        if not m:
            continue
        current_page = int(m.group(1))
        # Check if out-of-order or duplication:
        if last_page is not None:
            if current_page == last_page:
                problem_files[filename].append(
                    f"Duplicate page number encountered: {current_page}"
                )
            elif current_page < last_page:
                problem_files[filename].append(
                    f"Out-of-order page transition: {last_page} -> {current_page}"
                )
        last_page = current_page

    # If we found no issues, remove it from the problem_files dictionary
    if not problem_files[filename]:
        del problem_files[filename]


def main():
    all_files = [f for f in os.listdir(input_dir) if f.lower().endswith(".html")]

    print("Starting processing of HTML files...")
    for idx, filename in enumerate(all_files, start=1):
        print(f"Processing file {idx}/{len(all_files)}: {filename}")
        input_file = os.path.join(input_dir, filename)
        output_file = os.path.join(output_dir, filename)
        process_file(input_file, output_file)

    # Print summaries
    if no_pnum_files:
        print("\nFiles without a single p-num (no anchor pages, so minimal changes):")
        for fname in no_pnum_files:
            print(f" - {fname}")

    if problem_files:
        print("\nFiles with repeated or out-of-order page numbering after transformation:")
        for fname, issues in problem_files.items():
            print(f" - {fname}")
            for issue in issues:
                print(f"    * {issue}")

    if not no_pnum_files and not problem_files:
        print("\nAll files processed with no special issues.")


if __name__ == "__main__":
    main()
