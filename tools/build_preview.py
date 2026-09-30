"""Bundle the site into one self-contained file (used for the shareable preview page).
Usage: python3 tools/build_preview.py  ->  preview/preview.html
Not needed for GitHub Pages."""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda p: open(os.path.join(root, p), encoding="utf-8").read()
fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap">'
out = "\n".join([
    "<title>Banking Career Assessment</title>", fonts,
    "<style>\n" + read("css/styles.css") + "\n</style>",
    '<main class="wrap" id="app"></main>',
    "<script>window.PREVIEW_BUILD = true;</script>",
    "<script>\n" + read("js/config.js") + "\n</script>",
    "<script>\n" + read("js/scoring.js") + "\n</script>",
    "<script>\n" + read("js/app.js") + "\n</script>",
])
os.makedirs(os.path.join(root, "preview"), exist_ok=True)
open(os.path.join(root, "preview", "preview.html"), "w", encoding="utf-8").write(out)
print("wrote preview/preview.html", len(out), "bytes")
