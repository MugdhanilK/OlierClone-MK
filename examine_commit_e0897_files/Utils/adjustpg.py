from bs4 import BeautifulSoup
import re

input_file = "/home/olier/Olierdev/www/static/HTML/Autobiographical Notes_modified.html"
output_file = "/home/olier/Olierdev/www/static/HTML/Autobiographical Notes_modified_transformed.html"

with open(input_file, "r", encoding="utf-8") as f:
    html_content = f.read()

soup = BeautifulSoup(html_content, "lxml")

# 1) Remove all <span id="page_X"> elements
for span in soup.find_all("span", id=re.compile(r'page_\d+')):
    span.decompose()

# Collect all p-num and pg-num in the order they appear.
all_paragraphs = soup.find_all("p", class_=re.compile("p-num|pg-num"))

# Extract anchors (p-num) and their page numbers
anchors = []
for p in all_paragraphs:
    text = p.get_text(strip=True)
    m = re.search(r'Page\s+(\d+)', text, re.IGNORECASE)
    if m and "p-num" in p.get("class", []):
        anchors.append((int(m.group(1)), p))

if len(anchors) < 2:
    # If less than two anchors, just convert pg-num to p-num and done
    for p in all_paragraphs:
        if "pg-num" in p.get("class", []):
            p["class"] = ["p-num"]
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(str(soup))
    exit()

# We'll process each pair of consecutive anchors
for i in range(len(anchors)-1):
    start_page, start_anchor_tag = anchors[i]
    end_page, end_anchor_tag = anchors[i+1]

    # Get all elements between start_anchor and end_anchor
    segment_elems = []
    current = start_anchor_tag.next_sibling
    while current and current != end_anchor_tag:
        if current.name is not None:
            segment_elems.append(current)
        current = current.next_sibling

    expected_page = start_page + 1
    # We'll go through segment_elems and whenever we find a pg-num page, 
    # we ensure that all pages before it are inserted.
    # If the pg-num page number > expected_page, insert missing pages before it.
    # Then convert pg-num to p-num for its page.

    # To do this, we first extract page numbers for pg-num tags
    def get_page_num(tag):
        t = tag.get_text(strip=True)
        m = re.search(r'Page\s+(\d+)', t, re.IGNORECASE)
        return int(m.group(1)) if m else None

    for elem in segment_elems:
        if elem.has_attr('class') and 'pg-num' in elem['class']:
            pg_num = get_page_num(elem)

            # Insert missing pages before this pg-num if needed
            while expected_page < pg_num:
                # Insert a missing p-num and a blank before elem
                new_pnum = soup.new_tag("p", **{"class":"p-num"})
                new_pnum.string = f"Page {expected_page}"
                elem.insert_before(new_pnum)

                blank_p = soup.new_tag("p", **{"class":"blank"})
                blank_p.string = "[Blank]"
                elem.insert_before(blank_p)

                expected_page += 1

            # Now expected_page == pg_num, convert elem to p-num
            elem['class'] = ['p-num']
            elem.string = f"Page {expected_page}"
            expected_page += 1

        # If it's not a pg-num, just leave it as is
        # (For example <p class="p">X</p> remains unchanged.)

    # After processing all pg-num, if we still have pages before end_page, 
    # insert them before the end_anchor_tag.
    while expected_page < end_page:
        new_pnum = soup.new_tag("p", **{"class":"p-num"})
        new_pnum.string = f"Page {expected_page}"
        end_anchor_tag.insert_before(new_pnum)

        blank_p = soup.new_tag("p", **{"class":"blank"})
        blank_p.string = "[Blank]"
        end_anchor_tag.insert_before(blank_p)

        expected_page += 1

# Done processing all segments

with open(output_file, "w", encoding="utf-8") as f:
    f.write(str(soup))
