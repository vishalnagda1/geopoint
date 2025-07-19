# Customer Map Viewer

A frontend web application that visualizes customer data on an interactive map based on CSV file input containing latitude and longitude coordinates. Perfect for organizations that need to display customer locations geographically with support for large datasets (45,000+ records).

## Features

- 📊 **CSV File Upload**: Upload CSV files with customer data
- 🗺️ **Interactive Map**: View all customers on an interactive map using Leaflet.js
- 💾 **Local Storage**: Data persists in browser's local storage for future visits
- 🍔 **Burger Menu**: Easy navigation with customer list and data management
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎯 **Customer Focus**: Click on customer in the list to focus on their location
- 🧹 **Data Management**: Clear stored data and start fresh
- ✅ **Data Validation**: Validates CSV columns and coordinate data
- ⚡ **Batch Processing**: Handles large datasets (45,000+ records) efficiently
- 📈 **Progress Tracking**: Real-time progress indicator during data processing

## Required CSV Columns

Your CSV file must contain these columns (case-insensitive):
- `accno` - Account number
- `name` - Customer name
- `longitude` - Longitude coordinate
- `lattitude` - Latitude coordinate (note: can be "latitude" too)

Optional columns that will be displayed:
- `tariffcode` - Tariff code
- `kworhp` - KW or HP information
- `consumerstatus` - Consumer status
- `phase` - Phase information
- `meterno` - Meter number
- `consumption` - Consumption data
- `rdngmonth` - Reading month

## How to Use

1. **First Visit**: Upload your CSV file using the upload button
2. **Data Validation**: The app validates your data and shows any errors
3. **Batch Processing**: Large datasets are processed in batches with progress indicator
4. **Map View**: Successfully uploaded data is displayed on the map
5. **Navigation**: Use the burger menu to:
   - View list of all customers (first 100 shown for performance)
   - Click on any customer to focus on their location
   - Clear stored data
6. **Future Visits**: Data is automatically loaded from local storage

## Performance Features

- **Batch Processing**: Processes large CSV files (45,000+ records) in chunks
- **Progressive Loading**: Shows progress during data processing
- **Memory Management**: Optimizes localStorage usage for large datasets
- **Efficient Rendering**: Adds map markers in batches to prevent browser freezing

## Local Development

### Prerequisites
- Python 3 (for local server)
- Modern web browser

### Running Locally

1. Clone or download this repository
2. Navigate to the project directory
3. Start a local server:
   ```bash
   npm start
   # or
   python3 -m http.server 8000
   ```
4. Open your browser and go to `http://localhost:8000`

### Project Structure
```
/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript application logic
├── package.json        # Project configuration
└── README.md          # This file
```

## GitHub Pages Deployment

This application is designed to be easily deployed to GitHub Pages:

1. **Push to GitHub**: Upload your code to a GitHub repository
2. **Enable Pages**: Go to repository Settings → Pages
3. **Select Source**: Choose "Deploy from a branch" and select your main branch
4. **Access**: Your app will be available at `https://yourusername.github.io/repository-name`

### Automated Deployment (Optional)
If you want to use automated deployment:

1. Install gh-pages:
   ```bash
   npm install
   ```
2. Update the repository URL in `package.json`
3. Deploy:
   ```bash
   npm run deploy
   ```

## Dependencies

This project uses CDN-hosted libraries (no npm install required):
- **Leaflet.js**: Interactive maps
- **Modern CSS**: Responsive design with backdrop-filter effects

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 94+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 88+)

## Sample Data Format

Your CSV file should look like this:

```csv
accno,name,longitude,lattitude,tariffcode,kworhp,consumerstatus
01020001,AEN PHED,73.5308777,24.7633825,6000D,HP,R
01020002,AEN PHED JJY,73.4532100,24.8901234,5000D,HP,R
```

## Security & Privacy

- All data processing happens in the browser
- No data is sent to external servers
- Data is stored only in browser's local storage
- You can clear data anytime using the burger menu

## Troubleshooting

### Common Issues:

1. **"Missing required columns" error**: 
   - Ensure your Excel has columns named accno, name, longitude, lattitude
   - Column names are case-insensitive

2. **"No valid customer data found"**:
   - Check that longitude values are between -180 and 180
   - Check that latitude values are between -90 and 90
   - Ensure coordinate cells contain valid numbers

3. **Map not displaying**:
   - Check browser console for errors
   - Ensure you have internet connection (for map tiles)
   - Try refreshing the page

4. **File upload not working**:
   - Ensure file is .csv format
   - Check file isn't corrupted
   - Verify CSV has proper comma separation

5. **Performance issues with large files**:
   - The app processes data in batches automatically
   - Large datasets may take a few minutes to process
   - Check the progress bar during processing

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this application.
