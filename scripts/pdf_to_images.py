#!/usr/bin/env python3
"""
Convierte cada página de un PDF a PNG usando PyMuPDF (sin pdftoppm).
Uso: python pdf_to_images.py --pdf input.pdf --out /tmp/pages
Imprime el número de páginas generadas al stdout.
"""
import argparse
import os
import sys
import fitz  # PyMuPDF

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, help="Ruta al PDF de entrada")
    parser.add_argument("--out", required=True, help="Carpeta de salida para las imágenes")
    args = parser.parse_args()

    if not os.path.isfile(args.pdf):
        print(f"ERROR: archivo no encontrado: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)

    doc = fitz.open(args.pdf)
    count = 0
    for i, page in enumerate(doc):
        mat = fitz.Matrix(2.0, 2.0)  # zoom 2x para mejor calidad OCR
        pix = page.get_pixmap(matrix=mat)
        out_path = os.path.join(args.out, f"page-{i + 1:03d}.png")
        pix.save(out_path)
        count += 1

    print(count)  # Node.js lee este número del stdout

if __name__ == "__main__":
    main()
