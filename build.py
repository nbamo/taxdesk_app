"""Inline src/engine.js and src/app.js into src/shell.html -> index.html"""
from pathlib import Path
s = Path('src/shell.html').read_text()
e = Path('src/engine.js').read_text().replace("if (typeof module !== 'undefined')", "if (typeof module !== 'undefined' && module.exports)")
Path('index.html').write_text(s.replace('/*ENGINE*/', e).replace('/*APP*/', Path('src/app.js').read_text()))
print('built index.html')
