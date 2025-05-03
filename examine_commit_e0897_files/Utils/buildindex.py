import os
from bs4 import BeautifulSoup
import json
import re

# Adjust these paths to match your environment:
INPUT_DIRECTORY = "C:/Users/maste/OneDrive/Desktop/La Grace Project/The Job/Olierdev/www/static/HTML"
OUTPUT_INDEX_PATH = "C:/Users/maste/OneDrive/Desktop/La Grace Project/The Job/Olierdev/merged_auromira.jsonl"

def clean_text(text):
    """Simple utility to strip whitespace."""
    return text.strip()

def process_paragraph(element):
    """
    Extract text from a paragraph-like element by concatenating text nodes,
    handling <br>, <em>, <b>, <i>, and <span> if desired.
    """
    lines = []
    for child in element.children:
        if child.name == 'br':
            lines.append('\n')  # Treat <br> as a newline
        elif child.name in ['em', 'b', 'i', 'span']:  # Handle <em>, <b>, <i>, and <span> tags
            lines.append(clean_text(child.get_text()))  # Extract and clean their content
        elif child.name is None:  # Text node
            text = clean_text(child)
            if text:
                lines.append(text)
    # Turn multiple spaces/newlines into one space
    return ' '.join(' '.join(lines).split())

def add_sourcepos(soup):
    """
    Give each element a numerical order (sourcepos) to help with chapter detection
    and top-to-bottom traversals.
    """
    count = 0
    for elem in soup.find_all():
        count += 1
        elem.sourcepos = count


def extract_author_and_book(soup, filename):
    """
    Extract <author> if present. Ignore <title>; instead derive
    the book_title from the filename by removing '_modified.html' or '.html'.
    """
    # 1) Extract the author from <author> tag if available
    author_tag = soup.find('author')
    author = author_tag.get_text(strip=True) if author_tag else 'Unknown Author'

    # 2) Derive the book title from the filename
    #    Example: "Some Answers from the Mother_modified.html" -> "Some Answers from the Mother"
    #    or "Some Answers from the Mother.html" -> "Some Answers from the Mother"
    base = filename
    if base.endswith(".html"):
        base = base[:-5]  # remove .html
    if base.endswith("_modified"):
        base = base[:-9]  # remove _modified
    book_title = base

    return author, book_title


def get_chapter_positions(soup):
    """
    Identify all elements with class .Cp-Nm, sort by sourcepos, 
    so we can figure out the 'current chapter' for each paragraph.
    """
    chapter_positions = []
    for ch_el in soup.select('.Cp-Nm'):
        chapter_positions.append((ch_el, ch_el.get_text(strip=True)))
    chapter_positions.sort(key=lambda x: x[0].sourcepos)
    return chapter_positions



# A single global dictionary to track used acronyms across all files in one run
used_acronyms = {}  # { base_acronym: count_of_usage }

# -------------- ACRONYM HELPER --------------
def acronymize_title(full_title):
    """
    Convert a book title like:
      "Letters on Yoga I" -> "LOYI"
      "Questions and Answers 1953" -> "QAA1953"

    1) Lowercase the title
    2) Split on non-letters/digits
    3) Filter out short "stopwords" (like 'the', 'of', 'a', 'and', ...)
    4) Take the first letter of each remaining word, uppercase it
    5) Join them
    """
    stopwords = {"the", "of", "and", "to", "in", "a", "an", "on", "for", "at", "by", "from"}
    words = re.split(r"[^a-zA-Z0-9]+", full_title.lower())
    filtered = [w for w in words if w and w not in stopwords]
    letters = [w[0].upper() for w in filtered]
    return "".join(letters) if letters else "BOOK"


def label_paragraphs():
    """
    Overwrite each <p class="P"> in each HTML file with a fresh search_id.
    Ensures no two different books generate the same acronym in this single run.
    """
    # Gather all .html files
    all_files = [f for f in os.listdir(INPUT_DIRECTORY) if f.endswith(".html")]

    for filename in all_files:
        file_path = os.path.join(INPUT_DIRECTORY, filename)

        with open(file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract the book title
        title_tag = soup.find('title')
        full_book_title = title_tag.get_text(strip=True) if title_tag else "Unknown Book"
        
        # Create a base acronym
        base_acronym = acronymize_title(full_book_title)

        # Check if this base_acronym is already in use
        if base_acronym not in used_acronyms:
            used_acronyms[base_acronym] = 1
            final_acronym = base_acronym
        else:
            used_acronyms[base_acronym] += 1
            final_acronym = f"{base_acronym}_{used_acronyms[base_acronym]}"

        # Assign search_id to each <p class="P">
        p_elements = soup.find_all('p', class_='P')
        counter = 1
        for p_elem in p_elements:
            new_id = f"{final_acronym}-{counter}"
            p_elem['search_id'] = new_id
            counter += 1

        # Write the updated HTML back
        with open(file_path, 'w', encoding='utf-8') as out_f:
            out_f.write(str(soup))

        print(f"[{filename}] Labeled <p class='P'> using acronym '{final_acronym}'.")




# -----------------------------------------------------
# PHASE 2: Build the index (JSONL) with the new rules
# -----------------------------------------------------
def gather_above_q_ps_subhd(p_element):
    """
    Scan upwards from p_element:
      - Skip text/whitespace nodes.
      - If we see a <p class="P">, stop immediately (no more collection).
      - If we see <p class="Ps"> or <p class="Q">, collect text and continue scanning.
      - If we see <hN class="sub-hd"> or <p class="sub-hd">, 
        collect text AND stop immediately (break).
      - If we see <blockquote> containing <p class="Q">, collect that text, continue.

    Return a list of strings in *top-to-bottom* order.
    """
    collected = []
    sibling = p_element.previous_sibling

    while sibling:
        # Skip purely text/whitespace siblings
        if not getattr(sibling, 'name', None):
            sibling = sibling.previous_sibling
            continue

        # CASE 1: <p> or headings (<h1>.. <h6>)
        if sibling.name in ('p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            if sibling.has_attr('class'):
                classes = sibling['class']

                # If we see <p class="P"> => STOP
                if 'P' in classes and len(classes) == 1:
                    break

                # If sub-hd => collect & STOP
                if 'sub-hd' in classes:
                    collected.append(process_paragraph(sibling))
                    break

                # If Q, Ps => collect & continue
                # (We do NOT stop for Q or Ps)
                if 'Q' in classes or 'Ps' in classes:
                    collected.append(process_paragraph(sibling))

        # CASE 2: <blockquote> sibling with <p class="Q"> inside
        elif sibling.name == 'blockquote':
            # Find the first <p class="Q"> in the blockquote
            q_para = sibling.find('p', class_='Q')
            if q_para:
                collected.append(process_paragraph(q_para))
                # Not stopping unless you want blockquote to end scanning.

        # Move up to the next older sibling
        sibling = sibling.previous_sibling

    # We collected them from bottom-to-top, so reverse for top-to-bottom
    collected.reverse()
    return collected



def gather_below_pe_only(p_element):
    """
    Look *below* p_element, ignoring p-num, footnote, sec-br, Q, Ps, sub-hd, etc.
    Return the text of the *first* <p class="PE"> encountered, or "" if none found.
    Stop if we see another p.P.
    """
    sibling = p_element.next_sibling
    pe_text = ""

    while sibling:
        if not getattr(sibling, 'name', None):
            sibling = sibling.next_sibling
            continue

        if sibling.name == 'p' and sibling.has_attr('class'):
            classes = sibling['class']

            # If we see another <p class="P"> => STOP
            if 'P' in classes and len(classes) == 1:
                break

            # If we see <p class="PE"> => capture & STOP
            if 'PE' in classes:
                pe_text = process_paragraph(sibling)
                break

            # If Q, Ps, sub-hd, p-num, footnote, sec-br => just ignore and continue

        sibling = sibling.next_sibling

    return pe_text


def build_text_for_p(p_element):
    """
    1) Gather Q/Ps/sub-hd above in top-to-bottom order, ignoring p-num/footnote/sec-br.
    2) This <p class="P"> itself.
    3) If there's a <p class="PE"> below (ignoring p-num/sec-br), 
       concatenate it with a space.
    4) Combine them as: 
         <above1>\n\n<above2>\n\n...\n\n P_text (+ " " + PE_text if found)
    """
    above_list = gather_above_q_ps_subhd(p_element)  # multiple Q/Ps/sub-hd from top to bottom
    p_text = process_paragraph(p_element)
    pe_text = gather_below_pe_only(p_element)        # single PE

    # If we found PE, join with a space
    if pe_text:
        p_text = p_text + " " + pe_text

    # Final text is (above items) + main paragraph
    if above_list:
        # above items are separated by \n\n among themselves, 
        # then \n\n before the main P
        above_str = "\n\n".join(above_list)
        final_text = above_str + "\n\n" + p_text
    else:
        final_text = p_text

    return final_text


def build_index():
    """
    Go through each HTML file, gather p.P in source order,
    produce a JSON record for each p.P.
    """
    all_paragraphs_metadata = []

    for filename in os.listdir(INPUT_DIRECTORY):
        if not filename.endswith(".html"):
            continue
        file_path = os.path.join(INPUT_DIRECTORY, filename)

        with open(file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        soup = BeautifulSoup(html_content, 'html.parser')
        add_sourcepos(soup)

        author, book_title = extract_author_and_book(soup, filename)
        chapter_positions = get_chapter_positions(soup)

        # Gather p.P in ascending DOM order
        p_paras = soup.find_all('p', class_='P')
        p_paras_sorted = sorted(p_paras, key=lambda x: x.sourcepos)

        for p_para in p_paras_sorted:
            search_id = p_para.get('search_id')
            if not search_id:
                continue  # Should always be set, but just in case

            # Determine chapter (unchanged logic):
            current_chapter = 'Unknown Chapter'
            for (ch_el, ch_title) in chapter_positions:
                if ch_el.sourcepos < p_para.sourcepos:
                    current_chapter = ch_title
                else:
                    break

            # Build the combined text per your new rules
            combined_text = build_text_for_p(p_para)

            paragraph_metadata = {
                "author": author,
                "book_title": book_title,
                "chapter_title": current_chapter,
                "search_id": search_id,
                "text": combined_text,
            }
            all_paragraphs_metadata.append(paragraph_metadata)

    # Write as JSON Lines
    with open(OUTPUT_INDEX_PATH, 'w', encoding='utf-8') as outfile:
        for paragraph_metadata in all_paragraphs_metadata:
            json_str = json.dumps(paragraph_metadata, ensure_ascii=False)
            outfile.write(json_str + "\n")

    print(f"JSONL file created successfully at: {OUTPUT_INDEX_PATH}")


if __name__ == "__main__":
    # 1) Overwrite search_id in p.P with acronyms
    label_paragraphs()

    # 2) Build the index with the final logic
    build_index()
