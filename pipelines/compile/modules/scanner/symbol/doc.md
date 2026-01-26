---
icon: material/library-outline
---

Reuses previously generated [symbol files](https://doc.log10x.com/run/symbol/) to skip unchanged source files.

Each symbol file stores an MD5 checksum of its [input](https://doc.log10x.com/compile/sources/) file. Files matching existing checksums are skipped during [scanning](https://doc.log10x.com/compile/scan/#inputpaths).

[Pulling](https://doc.log10x.com/compile/scan/github/) prior symbol files and [pushing](https://doc.log10x.com/compile/push/) new ones enables incremental builds for large codebases.
