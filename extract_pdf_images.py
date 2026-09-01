from PyPDF2 import PdfReader
import os
import io
import base64

def extract_pdf_images(pdf_path, output_dir="images"):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    reader = PdfReader(pdf_path)
    count = 0
    
    for i, page in enumerate(reader.pages):
        for image_file_object in page.images:
            name = image_file_object.name
            data = image_file_object.data
            
            # Use count to generate a sequential SKU or product ID if possible
            # Or just save them sequentially and we can map them later
            count += 1
            file_path = os.path.join(output_dir, f"pdf_img_{count}_{name}")
            with open(file_path, "wb") as f:
                f.write(data)
                
    print(f"Extracted {count} images from PDF.")

if __name__ == "__main__":
    extract_pdf_images(r"C:\Users\Elijah John\Documents\A0860037.pdf")
