import os
from PIL import Image

# Open your image
img = Image.open('/home/olier/Olierbody/www/static/Olierbutton.png')

# Resize the image to 1080x1080
resized_img = img.resize((1080, 1080))

# Convert the image to 'RGB' to remove the alpha channel
resized_img = resized_img.convert('RGB')

# Save the resized image with reduced quality to decrease file size
output_path = 'resized_image.jpg'
resized_img.save(output_path, format='JPEG', quality=85, optimize=True)

# Print the size of the final image
file_size = os.path.getsize(output_path) / 1024  # Size in KB
print(f"File size: {file_size:.2f} KB")

print("Image resized and compressed successfully!")
