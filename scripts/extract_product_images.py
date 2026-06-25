# scripts/extract_product_images.py
import fitz  # PyMuPDF
import os
import sys
from PIL import Image
import numpy as np


def is_logo_region(rect, page_rect, page_num, page_h):
    """
    Detecta imágenes que probablemente son logos o cabeceras:
    - En la primera página y en el 20% superior
    - O muy anchas y cortas (banners/cabeceras)
    """
    if page_num == 1:
        y_center = (rect.y0 + rect.y1) / 2
        if y_center < page_h * 0.20:
            return True

    w = rect.x1 - rect.x0
    h = rect.y1 - rect.y0
    if h > 0 and (w / h) > 4:  # banner horizontal
        return True

    return False


def is_valid_product_image(pix, min_area=15000):
    """Filtra basura: líneas, celdas, blancos, imágenes muy pequeñas."""
    w, h = pix.width, pix.height
    area = w * h

    if area < min_area:
        return False

    # Evitar líneas horizontales o verticales extremas
    ratio = max(w / h, h / w)
    if ratio > 6:
        return False

    # Detectar imágenes casi blancas / sin variación
    img = Image.frombytes("RGB", [w, h], pix.samples)
    arr = np.array(img)
    mean_color = arr.mean()
    std_color = arr.std()

    if mean_color > 245 and std_color < 5:
        return False

    # Imagen casi completamente de un solo color (fondos planos)
    if std_color < 3:
        return False

    return True


def extract_images_from_pdf(pdf_path, output_folder, zoom=2.0):
    os.makedirs(output_folder, exist_ok=True)

    doc = fitz.open(pdf_path)
    count = 0

    for page_num, page in enumerate(doc, start=1):
        page_rect = page.rect
        page_h = float(page_rect.height)
        items = []

        for img in page.get_images(full=True):
            xref = img[0]
            rects = page.get_image_rects(xref)

            for rect in rects:
                if rect.is_empty:
                    continue

                # Saltar logos y cabeceras
                if is_logo_region(rect, page_rect, page_num, page_h):
                    continue

                y_center = (rect.y0 + rect.y1) / 2
                x_left = rect.x0
                items.append((y_center, x_left, xref, rect))

        # Orden visual: de arriba hacia abajo, de izquierda a derecha
        items.sort(key=lambda x: (x[0], x[1]))

        for _, __, xref, rect in items:
            try:
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, clip=rect, alpha=False)

                if not is_valid_product_image(pix):
                    continue

                count += 1
                out = os.path.join(output_folder, f"image_{count:03d}.png")
                pix.save(out)

            except Exception:
                continue

    print(count)
    return count


if __name__ == "__main__":
    pdf = sys.argv[sys.argv.index("--pdf") + 1]
    out = sys.argv[sys.argv.index("--out") + 1]
    extract_images_from_pdf(pdf, out)
