import re

with open('site/app.js', 'r') as f:
    app_js = f.read()

with open('map_logic.js', 'r') as f:
    map_logic = f.read()

# Inject map logic before renderAll
target_str = "// ---------------------------------------------------------------------------\n// renderAll"
if target_str in app_js:
    app_js = app_js.replace(target_str, map_logic + "\n" + target_str)
else:
    print("Could not find renderAll target")

# Inject syncMapTheme into applyTheme
theme_target = "syncThemeToggleButton();"
if theme_target in app_js:
    app_js = app_js.replace(theme_target, theme_target + "\n  syncMapTheme();")

# Inject bindEvents for mapToggleBtn
bind_target = "if (elements.scheduleToggleBtn) {"
bind_injection = """
  if (elements.mapToggleBtn) {
    elements.mapToggleBtn.addEventListener('click', () => {
      const isExpanded = elements.mapToggleBtn.getAttribute('aria-expanded') === 'true';
      elements.mapToggleBtn.setAttribute('aria-expanded', String(!isExpanded));
      elements.mapSection.hidden = isExpanded;
      if (!isExpanded && state.map) {
        state.map.invalidateSize();
      }
    });
  }
"""
if bind_target in app_js:
    app_js = app_js.replace(bind_target, bind_injection + "\n  " + bind_target)

# Inject renderMapMarkers inside renderAll
render_target = "renderRaces(filtered);"
if render_target in app_js:
    app_js = app_js.replace(render_target, render_target + "\n  renderMapMarkers(filtered);")

# Inject loadCountryCoords and initMap inside init
init_target = "startUtcClock();"
if init_target in app_js:
    app_js = app_js.replace(init_target, init_target + "\n  await loadCountryCoords();\n  initMap();")

with open('site/app.js', 'w') as f:
    f.write(app_js)

print("Injected map logic successfully.")
