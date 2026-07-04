import re

with open('app.js', 'r') as f:
    content = f.read()

missing_code = """
function loadPersistedFavorites() {
  const arr = readStorageJson(FAVORITES_STORAGE_KEY);
  if (!Array.isArray(arr)) return;
  state.favorites = new Set(arr.map(v => String(v || '').trim()).filter(Boolean));
}
"""

insert_idx = content.find("function toggleFavoriteByKey")
if insert_idx != -1:
    new_content = content[:insert_idx] + missing_code + content[insert_idx:]
    with open('app.js', 'w') as f:
        f.write(new_content)
    print("Fixed loadPersistedFavorites")
else:
    print("Could not find insertion point")
