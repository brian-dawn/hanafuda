PORT ?= 5173

.PHONY: help serve test assets clean

help:
	@echo "Koi-Koi web demo — targets:"
	@echo "  make serve    — start local HTTP server on PORT (default $(PORT))"
	@echo "  make test     — run the Playwright e2e suite"
	@echo "  make assets   — (re-)fetch the 48 card SVGs from Wikimedia"
	@echo "  make clean    — remove assets and node_modules"

serve:
	@echo "Serving on http://localhost:$(PORT)/"
	python3 -m http.server $(PORT)

test:
	node test-e2e.mjs

assets:
	bash scripts/fetch-assets.sh

clean:
	rm -rf node_modules assets/cards/*.svg assets/CREDITS.md
