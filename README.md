# GeoPoint

A high-performance, frontend-only web application to visualize large sets of customer data from a CSV file on an interactive map. This tool is designed to handle tens of thousands of data points smoothly without a backend, using modern browser technologies for data storage and rendering.

## Features

- **CSV File Upload**: Easily upload your customer data via a simple drag-and-drop interface or file selector.
- **Large Dataset Support**: Built to handle 100,000+ records by leveraging IndexedDB for efficient client-side storage.
- **Interactive Map**: Uses Leaflet.js with marker clustering to provide a smooth, responsive map experience even with a high density of markers.
- **Client-Side Storage**: All data is stored locally in the user's browser using IndexedDB, ensuring data privacy and enabling offline access after the initial load.
- **Search and Filter**: Quickly search for customers by account number or name through an indexed search in the sidebar.
- **Detailed Popups & Tooltips**: Click on a marker to view detailed information for each customer. Hover over a marker to see a quick tooltip with coordinates.
- **Spiderfy for Overlapping Markers**: Automatically spreads out markers that are at the exact same coordinates for easy selection.
- **Responsive Design**: A clean and simple UI that works on different screen sizes.
- **No Backend Required**: The entire application runs in the browser, making it easy to deploy on any static hosting service.

## Getting Started

To run the application locally, you need Python 3 installed to serve the files.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/vishalnagda1/geopoint.git
    cd geopoint
    ```

2.  **Start the local server:**
    The project includes a simple script to start a local server.
    ```bash
    npm start
    ```
    Alternatively, you can run the Python server command directly:
    ```bash
    python3 -m http.server 8000
    ```

3.  **Open the application:**
    Open your web browser and navigate to `http://localhost:8000`.

## How to Use

1.  **Upload Data**: On the home page, drag and drop your CSV file onto the upload area, or click to select it from your computer.
2.  **Data Processing**: The application will process the CSV, validate the data, and store it in your browser's IndexedDB. A progress bar will show the status.
3.  **Explore the Map**: Once processing is complete, you will be taken to the map view where your customers are displayed as clustered markers.
4.  **Search**: Use the search bar in the sidebar menu to find specific customers.
5.  **Clear Data**: You can clear all stored data from the browser by clicking the "Clear Data" button in the menu.

## CSV File Format

Your CSV file must contain the following columns for the application to work correctly:
- `accno`
- `name`
- `longitude`
- `lattitude`

Other columns are also read and displayed in the marker popups if present (e.g., `tariffcode`, `kworhp`, `consumerstatus`, etc.).

## Technical Stack

- **HTML5 / CSS3**
- **Vanilla JavaScript (ES6+)**: No frameworks, just modern JavaScript.
- **Leaflet.js**: An open-source JavaScript library for mobile-friendly interactive maps.
- **Leaflet.markercluster**: A Leaflet plugin for clustering markers.
- **IndexedDB**: A low-level API for client-side storage of significant amounts of structured data.

## Deployment

This application is ready to be deployed on any static web hosting service like GitHub Pages, Netlify, or Vercel. The `package.json` includes a `deploy` script using `gh-pages` as an example for deploying to GitHub Pages.
