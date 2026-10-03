#!/usr/bin/env python3
"""
PulseSnap / Little Ables - Unsplash 1-Click Downloader
Downloads 10 curated Unsplash images for each of the 6 news categories directly into your 'img/' folder!
"""

import os
import time
import urllib.request

# The 60 Curated Unsplash Photos (10 per category)
UNSPLASH_CATALOG = {
    "animals": [
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop", # Dog
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop", # Cat
        "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&auto=format&fit=crop", # Golden retriever
        "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&auto=format&fit=crop", # Red fox
        "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop", # Sea turtle
        "https://images.unsplash.com/photo-1484406566174-9da000fda645?w=800&auto=format&fit=crop", # Deer in mist
        "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=800&auto=format&fit=crop", # Cute puppy
        "https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=800&auto=format&fit=crop", # Kitten
        "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=800&auto=format&fit=crop", # Playful pug
        "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop"  # Animal friends
    ],
    "tech": [
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop", # Circuit board
        "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop", # AI brain nodes
        "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop", # Robotics hand
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop", # Tech workspace
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop", # Satellite orbit
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop", # Data center server
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop", # Digital tech laptops
        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format&fit=crop", # Laptop glowing
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop", # Code matrix screen
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop"  # Cyber security
    ],
    "arts": [
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop", # Craft beads
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop", # Artist palette
        "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&auto=format&fit=crop", # Pottery ceramics
        "https://images.unsplash.com/photo-1549887534-1541e9326642?w=800&auto=format&fit=crop", # Street art mural
        "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=800&auto=format&fit=crop", # Yarn weaving
        "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop", # Graphic design
        "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop", # Color gallery
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop", # Painting canvas
        "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop", # Handmade sketch
        "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800&auto=format&fit=crop"  # Acrylic canvas
    ],
    "world": [
        "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=800&auto=format&fit=crop", # City skyline
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop", # World architecture
        "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800&auto=format&fit=crop", # Shipping harbor
        "https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=800&auto=format&fit=crop", # High-speed rail
        "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&auto=format&fit=crop", # Globe map
        "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&auto=format&fit=crop", # Global summit
        "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&auto=format&fit=crop", # City bridge
        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop", # Paris landmark
        "https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?w=800&auto=format&fit=crop", # Downtown street
        "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop"  # Global landscape
    ],
    "uplifting": [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop", # Sunrise meadow
        "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop", # Blooming daisy
        "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=800&auto=format&fit=crop", # Sunbeams forest
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop", # Joyful friends
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop", # Coastal waves
        "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&auto=format&fit=crop", # Warm tea book
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop", # Happy smile
        "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&auto=format&fit=crop", # Morning sunshine
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop", # Mountain calm
        "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop"  # Sunburst trees
    ],
    "all": [
        "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop", # Newsroom camera
        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop", # Morning news coffee
        "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&auto=format&fit=crop", # Press conference mics
        "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&auto=format&fit=crop", # Breaking news wire
        "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&auto=format&fit=crop", # Press camera lens
        "https://images.unsplash.com/photo-1527525443983-6e60c75fff46?w=800&auto=format&fit=crop", # Broadcast monitors
        "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop", # Press books
        "https://images.unsplash.com/photo-1586339949916-3e9457bef6d3?w=800&auto=format&fit=crop", # Headline broadsheet
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop", # Tablet news
        "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800&auto=format&fit=crop"  # Newspaper stack
    ]
}

def download_images():
    os.makedirs("img", exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    total = sum(len(urls) for urls in UNSPLASH_CATALOG.values())
    count = 0

    print(f"🚀 Starting download of {total} Unsplash photos into 'img/' folder...\n")

    for category, urls in UNSPLASH_CATALOG.items():
        print(f"📁 Downloading {category.upper()} photos...")
        for i, url in enumerate(urls, 1):
            dest = os.path.join("img", f"{category}_{i}.jpg")
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=10) as response, open(dest, "wb") as out_file:
                    out_file.write(response.read())
                count += 1
                print(f"  [✓] Saved {dest} ({count}/{total})")
            except Exception as err:
                print(f"  [!] Failed to download {url}: {err}")
            time.sleep(0.3)

    print(f"\n✨ All done! Successfully downloaded {count}/{total} photos into 'img/'!")

if __name__ == "__main__":
    download_images()
