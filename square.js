const Jimp = require('jimp');

async function squareImage(input, output) {
    try {
        const image = await Jimp.read(input);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        const size = Math.max(width, height);

        // Create a new square image with a transparent background
        const bg = new Jimp(size, size, 0x00000000);

        // Calculate position to center the image
        const x = (size - width) / 2;
        const y = (size - height) / 2;

        bg.composite(image, x, y);

        await bg.writeAsync(output);
        console.log(`Successfully squared the image to ${size}x${size} and saved to ${output}`);
    } catch (error) {
        console.error('Error during image processing:', error);
    }
}

squareImage('logo.png', 'logo_sq.png');
