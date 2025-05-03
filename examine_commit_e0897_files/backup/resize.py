from PIL import Image

# Open the image
image_path = '/home/olier/Olierbody/splitscreen.png'  # Replace with your image path
img = Image.open(image_path)

# Resize the image to 1024x500
new_size = (1024, 500)
resized_img = img.resize(new_size, Image.LANCZOS)

# Save the resized image
resized_img.save('resized_image.png')
print("Image resized and saved as resized_image.png")

