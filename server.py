import http.server
import socketserver
import json
import os
import base64

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        if self.path == '/api/save':
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('products.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        
        elif self.path == '/api/save_about':
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('about.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/save_restaurant':
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('restaurant.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/save_bundles':
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('bundles.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/import_batch':
            try:
                data = json.loads(post_data.decode('utf-8'))
                products = data.get('products', [])
                
                existing_products = []
                if os.path.exists('products.json'):
                    with open('products.json', 'r', encoding='utf-8') as f:
                        try:
                            existing_products = json.load(f)
                        except:
                            pass
                
                existing_skus = {str(p.get('id', '')) for p in existing_products}
                
                report = {
                    'valid': 0,
                    'failed': 0,
                    'duplicate_skus': 0,
                    'missing_images': 0,
                    'errors': [],
                    'missing_image_list': []
                }
                
                new_products = []
                
                for p in products:
                    sku = str(p.get('sku') or p.get('barcode') or '').strip()
                    name = str(p.get('name', '')).strip()
                    price = p.get('price')
                    
                    if not sku or not name or price is None or str(price).strip() == '':
                        report['failed'] += 1
                        report['errors'].append(f"Row missing required fields (SKU/Name/Price): {name or sku}")
                        continue
                    
                    try:
                        price_val = float(price)
                        if price_val <= 0:
                            raise ValueError()
                    except:
                        report['failed'] += 1
                        report['errors'].append(f"Invalid price for SKU {sku}: {price}")
                        continue
                        
                    if sku in existing_skus:
                        report['duplicate_skus'] += 1
                        report['errors'].append(f"Duplicate SKU {sku} skipped")
                        continue
                        
                    img_url = str(p.get('img', '') or p.get('image', '')).strip()
                    if not img_url:
                        img_path = f"images/product_{sku}.jpg"
                        img_path_png = f"images/product_{sku}.png"
                        if os.path.exists(img_path):
                            img_url = img_path
                        elif os.path.exists(img_path_png):
                            img_url = img_path_png
                        else:
                            report['missing_images'] += 1
                            report['missing_image_list'].append(name)
                            img_url = f"images/default_product.jpg"
                    else:
                        if img_url.startswith('data:image'):
                            base64_str = img_url.split(',')[1] if ',' in img_url else img_url
                            img_data = base64.b64decode(base64_str)
                            img_filename = f"images/product_{sku}.jpg"
                            if not os.path.exists('images'):
                                os.makedirs('images')
                            with open(img_filename, 'wb') as f:
                                f.write(img_data)
                            img_url = img_filename
                        
                    mrp = p.get('mrp')
                    try:
                        mrp_val = float(mrp)
                        if mrp_val > price_val:
                            discount_pct = int(((mrp_val - price_val) / mrp_val) * 100)
                            p['discount'] = f"{discount_pct}%"
                            if discount_pct >= 20:
                                p['badge'] = "Best Before Savings"
                            elif discount_pct > 0:
                                p['badge'] = "Smart Value"
                    except:
                        mrp_val = price_val
                        
                    stock = p.get('stock', 10)
                    try:
                        stock = int(stock)
                    except:
                        stock = 10
                        
                    valid_product = {
                        'id': sku,
                        'name': name,
                        'brand': p.get('brand', 'Generic'),
                        'category': p.get('category', 'Stationery & Miscellaneous'),
                        'price': price_val,
                        'mrp': mrp_val,
                        'stock': stock,
                        'img': img_url,
                        'description': p.get('description', ''),
                        'color': p.get('color', '#9E9E9E'),
                        'discount': p.get('discount', ''),
                        'badge': p.get('badge', '')
                    }
                    
                    new_products.append(valid_product)
                    existing_skus.add(sku)
                    report['valid'] += 1
                    
                if new_products:
                    existing_products.extend(new_products)
                    with open('products.json', 'w', encoding='utf-8') as f:
                        json.dump(existing_products, f, indent=4)
                        
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(report).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/save_categories':
            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('categories.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/upload_image':
            try:
                data = json.loads(post_data.decode('utf-8'))
                filename = data.get('filename')
                if not filename:
                    product_id = data.get('productId')
                    filename = f"images/product_{product_id}.jpg"
                
                base64_str = data.get('image_base64')
                
                # Strip the data:image/jpeg;base64, prefix
                if ',' in base64_str:
                    base64_str = base64_str.split(',')[1]
                
                img_data = base64.b64decode(base64_str)
                
                if not os.path.exists('images'):
                    os.makedirs('images')
                
                with open(filename, 'wb') as f:
                    f.write(img_data)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"url": filename}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
