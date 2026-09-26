# Deep Learning Lab — common tasks
#   make update   import new/changed notebooks from ../Day N folders, then rebuild
#   make serve    build and preview at http://localhost:8000
#   make publish  commit everything and push (GitHub Actions rebuilds and deploys the site)

PY ?= python3

.PHONY: build sync update serve publish clean questions

build:
	$(PY) scripts/build.py

sync:
	$(PY) scripts/sync_notes.py

update: sync build

serve:
	$(PY) scripts/build.py --serve

questions:
	@$(PY) scripts/build.py --questions $(L)

publish: update
	git add -A
	git commit -m "Update lessons ($$(date +%Y-%m-%d))" || true
	git push

clean:
	rm -rf dist
