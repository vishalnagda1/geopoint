# Customer Map Viewer

A frontend web application that visualizes customer data on an interactive map based on Excel file input containing latitude and longitude coordinates. Perfect for organizations that need to display customer locations geographically.

## Features

- 📊 **Excel File Upload**: Upload Excel files (.xlsx, .xls) with customer data
- 🗺️ **Interactive Map**: View all customers on an interactive map using Leaflet.js
- 💾 **Local Storage**: Data persists in browser's local storage for future visits
- 🍔 **Burger Menu**: Easy navigation with customer list and data management
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎯 **Customer Focus**: Click on customer in the list to focus on their location
- 🧹 **Data Management**: Clear stored data and start fresh
- ✅ **Data Validation**: Validates Excel columns and coordinate data

## Required Excel Columns

Your Excel file must contain these columns (case-insensitive):
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

1. **First Visit**: Upload your Excel file using the upload button
2. **Data Validation**: The app validates your data and shows any errors
3. **Map View**: Successfully uploaded data is displayed on the map
4. **Navigation**: Use the burger menu to:
   - View list of all customers
   - Click on any customer to focus on their location
   - Clear stored data
5. **Future Visits**: Data is automatically loaded from local storage

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
- **SheetJS**: Excel file processing
- **Modern CSS**: Responsive design with backdrop-filter effects

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 94+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 88+)

## Sample Data Format

Your Excel file should look like this:

| accno | name | longitude | lattitude | tariffcode | kworhp | consumerstatus |
|-------|------|-----------|-----------|------------|---------|----------------|
| 01020001 | AEN PHED | 73.5308777 | 24.7633825 | 6000D | HP | R |
| 01020002 | AEN PHED JJY | 73.4532100 | 24.8901234 | 5000D | HP | R |

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

4. **File upload not working**:
   - Ensure file is .xlsx or .xls format
   - Check file isn't corrupted

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this application.
