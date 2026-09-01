import json
import urllib.request
import urllib.parse
import os
import sys
import concurrent.futures

def fetch_image_for_product(args):
    idx, p, api_key = args
    img_val = p.get('img', '')
    # Skip if it already has a good external image (Serper results are http)
    if img_val and img_val.startswith('http') and 'wikipedia' not in img_val and 'placehold.co' not in img_val:
        return idx, p, False

    query = f"{p.get('brand', '')} {p.get('name', '')} product white background".strip()
    url = "https://google.serper.dev/images"
    payload = json.dumps({
        "q": query,
        "num": 1
    }).encode('utf-8')
    headers = {
        'X-API-KEY': api_key,
        'Content-Type': 'application/json'
    }

    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            images = res_data.get('images', [])
            if images and len(images) > 0:
                img_url = images[0].get('imageUrl')
                if img_url:
                    p['img'] = img_url
                    print(f"[{idx+1}] Found for {p['name']}: {img_url}")
                    return idx, p, True
    except Exception as e:
        print(f"[{idx+1}] Error for {p['name']}: {e}")

    return idx, p, False

def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_serper_images.py <API_KEY>")
        return

    api_key = sys.argv[1]
    
    print("Loading products.json...")
    with open('products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
        
    total = len(products)
    print(f"Loaded {total} products.")
    
    args_list = [(i, p, api_key) for i, p in enumerate(products)]
    updated_count = 0
    
    # We use ThreadPoolExecutor to speed up the 300+ requests
    # Serper can handle a few concurrent requests easily.
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        for idx, updated_p, changed in executor.map(fetch_image_for_product, args_list):
            products[idx] = updated_p
            if changed:
                updated_count += 1
                
            # Periodically save
            if updated_count > 0 and updated_count % 20 == 0:
                with open('products.json', 'w', encoding='utf-8') as f:
                    json.dump(products, f, indent=4)

    # Final save
    with open('products.json', 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=4)
        
    print(f"Finished! Successfully updated {updated_count} products with real images.")

if __name__ == "__main__":
    main()
