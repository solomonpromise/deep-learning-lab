# Deep Learning Lab — common tasks
#   make update   import new/changed notebooks from ../Day N folders, then rebuild
#   make serve    build and preview at http://localhost:8000
#   make publish  commit everything and push (GitHub Actions rebuilds and deploys the site)

PY ?= python3

.PHONY: build sync update serve publish clean questions defs docstrings

build:
	$(PY) scripts/build.py

sync:
	$(PY) scripts/sync_notes.py

update: sync build

serve:
	$(PY) scripts/build.py --serve

questions:
	@$(PY) scripts/build.py --questions $(L)

defs:
	@$(PY) scripts/build.py --defs $(L)

# Draft docstrings for undocumented functions/classes with the AI model (needs GROQ_API_KEY)
docstrings:
	$(PY) scripts/draft_docstrings.py $(L) $(ARGS)

publish: update
	git add -A
	git commit -m "Update lessons ($$(date +%Y-%m-%d))" || true
	git push

clean:
	rm -rf dist
