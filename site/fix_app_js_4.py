import re

with open('app.js', 'r') as f:
    content = f.read()

missing_code = """
function indexForSearch(transmissoes) {
  transmissoes.forEach(tx => { tx._searchText = buildTxSearchText(tx); });
}
"""

insert_idx = content.find("function applyFilters")
if insert_idx != -1:
    new_content = content[:insert_idx] + missing_code + content[insert_idx:]
    with open('app.js', 'w') as f:
        f.write(new_content)
    print("Fixed indexForSearch")
else:
    print("Could not find insertion point")
