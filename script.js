class CustomerMapApp {
    constructor() {
        this.customers = [];
        this.map = null;
        this.markers = [];
        this.markerClusterGroup = null;
        this.requiredColumns = ['accno', 'name', 'longitude', 'lattitude'];
        this.batchSize = 1000; // Process 1000 records at a time
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkStoredData();
    }

    bindEvents() {
        // File upload events
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Burger menu events
        const burgerIcon = document.getElementById('burgerIcon');
        const menuContent = document.getElementById('menuContent');
        const clearData = document.getElementById('clearData');

        burgerIcon.addEventListener('click', () => {
            burgerIcon.classList.toggle('active');
            menuContent.classList.toggle('active');
        });

        clearData.addEventListener('click', this.clearStoredData.bind(this));

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.burger-menu')) {
                burgerIcon.classList.remove('active');
                menuContent.classList.remove('active');
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        // Validate file type
        if (!file.name.match(/\.csv$/i) && file.type !== 'text/csv') {
            this.showError('Please upload a valid CSV file (.csv)');
            return;
        }

        this.showLoading(true);
        this.hideError();
        this.updateProgress(0);

        try {
            console.log('Starting file processing...');
            const csvText = await this.readCSVFile(file);
            console.log('File read successfully, parsing CSV...');
            
            const data = await this.parseCSV(csvText);
            console.log(`Parsed ${data.length} rows from CSV`);
            
            const validatedData = await this.validateDataInBatches(data);
            console.log(`Validated ${validatedData.length} records`);
            
            if (validatedData.length === 0) {
                throw new Error('No valid customer data found with required columns and coordinates');
            }

            this.customers = validatedData;
            console.log('Saving to localStorage...');
            await this.saveToLocalStorage();
            console.log('Data saved, showing map...');
            this.showMapPage();
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    readCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    resolve(e.target.result);
                } catch (error) {
                    reject(new Error('Failed to read CSV file. Please ensure it\'s a valid CSV file.'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read the file'));
            };
            
            reader.readAsText(file);
        });
    }

    async parseCSV(csvText) {
        return new Promise((resolve) => {
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const values = this.parseCSVLine(line);
                    if (values.length === headers.length) {
                        const row = {};
                        headers.forEach((header, index) => {
                            row[header] = values[index] ? values[index].trim() : '';
                        });
                        data.push(row);
                    }
                }
            }
            resolve(data);
        });
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result.map(val => val.replace(/"/g, ''));
    }

    async validateDataInBatches(data) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('CSV file is empty or invalid');
        }

        // Check if required columns exist
        const firstRow = data[0];
        const availableColumns = Object.keys(firstRow).map(col => col.toLowerCase().trim());
        
        const missingColumns = this.requiredColumns.filter(col => 
            !availableColumns.some(availCol => availCol.includes(col.toLowerCase()))
        );

        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }

        const validCustomers = [];
        const totalBatches = Math.ceil(data.length / this.batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * this.batchSize;
            const end = Math.min(start + this.batchSize, data.length);
            const batch = data.slice(start, end);
            
            const batchValidated = batch.filter(row => {
                const accno = this.getColumnValue(row, 'accno');
                const name = this.getColumnValue(row, 'name');
                const longitude = this.getColumnValue(row, 'longitude');
                const latitude = this.getColumnValue(row, 'lattitude');

                return accno && name && 
                       this.isValidCoordinate(longitude, -180, 180) && 
                       this.isValidCoordinate(latitude, -90, 90);
            }).map(row => ({
                accno: this.getColumnValue(row, 'accno'),
                name: this.getColumnValue(row, 'name'),
                longitude: parseFloat(this.getColumnValue(row, 'longitude')),
                latitude: parseFloat(this.getColumnValue(row, 'lattitude')),
                tariffcode: this.getColumnValue(row, 'tariffcode') || '',
                kworhp: this.getColumnValue(row, 'kworhp') || '',
                consumerstatus: this.getColumnValue(row, 'consumerstatus') || '',
                phase: this.getColumnValue(row, 'phase') || '',
                meterno: this.getColumnValue(row, 'meterno') || '',
                consumption: this.getColumnValue(row, 'consumption') || '',
                rdngmonth: this.getColumnValue(row, 'rdngmonth') || ''
            }));
            
            validCustomers.push(...batchValidated);
            
            // Update progress
            const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
            this.updateProgress(progress);
            
            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`Validated ${validCustomers.length} customers out of ${data.length} total records`);
        return validCustomers;
    }

    getColumnValue(row, columnName) {
        // Try to find the column with case-insensitive matching
        const key = Object.keys(row).find(k => 
            k.toLowerCase().trim().includes(columnName.toLowerCase())
        );
        return key ? String(row[key]).trim() : '';
    }

    isValidCoordinate(value, min, max) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= min && num <= max && value !== '' && value != null;
    }

    showMapPage() {
        console.log('Showing map page...');
        document.getElementById('homePage').style.display = 'none';
        document.getElementById('mapPage').style.display = 'block';
        
        // Small delay to ensure the map container is visible
        setTimeout(() => {
            if (!this.map) {
                console.log('Initializing map...');
                this.initializeMap();
            }
            this.displayCustomersOnMap();
            this.updateCustomerList();
            this.updateCustomerCount();
        }, 100);
    }

    initializeMap() {
        try {
            console.log('Creating map...');
            // Initialize map with a default view
            this.map = L.map('map', {
                center: [24.5854, 73.7125], // Default to Rajasthan, India
                zoom: 6,
                zoomControl: true,
                scrollWheelZoom: true
            });

            console.log('Adding tile layer...');
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                minZoom: 3
            }).addTo(this.map);

            // Force map to resize after initialization
            setTimeout(() => {
                this.map.invalidateSize();
                console.log('Map initialized and resized');
            }, 200);

        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to initialize map. Please refresh the page and try again.');
        }
    }

    async displayCustomersOnMap() {
        if (!this.map) {
            console.error('Map not initialized');
            return;
        }

        console.log(`Displaying ${this.customers.length} customers on map...`);
        
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        if (this.customers.length === 0) return;

        // For large datasets, add markers in batches
        const bounds = [];
        const totalBatches = Math.ceil(this.customers.length / this.batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * this.batchSize;
            const end = Math.min(start + this.batchSize, this.customers.length);
            const batch = this.customers.slice(start, end);
            
            batch.forEach(customer => {
                try {
                    const marker = L.marker([customer.latitude, customer.longitude])
                        .addTo(this.map);
                    
                    const popupContent = this.createPopupContent(customer);
                    marker.bindPopup(popupContent);
                    
                    this.markers.push(marker);
                    bounds.push([customer.latitude, customer.longitude]);
                } catch (error) {
                    console.error('Error adding marker for customer:', customer.accno, error);
                }
            });
            
            // Allow UI to update between batches
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // Fit map to show all markers
        if (bounds.length > 0) {
            try {
                this.map.fitBounds(bounds, { padding: [20, 20] });
                console.log('Map bounds fitted to markers');
            } catch (error) {
                console.error('Error fitting bounds:', error);
            }
        }
    }

    createPopupContent(customer) {
        return `
            <div class="popup-content">
                <h3>${customer.name}</h3>
                <p><strong>Account No:</strong> ${customer.accno}</p>
                <p><strong>Tariff Code:</strong> ${customer.tariffcode}</p>
                <p><strong>KW/HP:</strong> ${customer.kworhp}</p>
                <p><strong>Status:</strong> ${customer.consumerstatus}</p>
                <p><strong>Phase:</strong> ${customer.phase}</p>
                <p><strong>Meter No:</strong> ${customer.meterno}</p>
                <p><strong>Consumption:</strong> ${customer.consumption}</p>
                <p><strong>Reading Month:</strong> ${customer.rdngmonth}</p>
                <p><strong>Coordinates:</strong> ${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}</p>
            </div>
        `;
    }

    updateCustomerList() {
        const customerList = document.getElementById('customerList');
        customerList.innerHTML = '';

        if (this.customers.length === 0) return;

        // Add header
        const header = document.createElement('div');
        header.className = 'menu-item';
        header.innerHTML = '<strong>Customers:</strong>';
        header.style.pointerEvents = 'none';
        header.style.background = 'rgba(0, 0, 0, 0.05)';
        customerList.appendChild(header);

        // Add customer items (limit to first 100 for performance)
        const displayLimit = Math.min(100, this.customers.length);
        for (let i = 0; i < displayLimit; i++) {
            const customer = this.customers[i];
            const item = document.createElement('div');
            item.className = 'customer-item';
            item.textContent = `${customer.accno} - ${customer.name}`;
            item.addEventListener('click', () => {
                this.focusOnCustomer(i);
                // Close menu
                document.getElementById('burgerIcon').classList.remove('active');
                document.getElementById('menuContent').classList.remove('active');
            });
            customerList.appendChild(item);
        }

        if (this.customers.length > displayLimit) {
            const moreItem = document.createElement('div');
            moreItem.className = 'customer-item';
            moreItem.textContent = `... and ${this.customers.length - displayLimit} more`;
            moreItem.style.fontStyle = 'italic';
            moreItem.style.pointerEvents = 'none';
            customerList.appendChild(moreItem);
        }
    }

    focusOnCustomer(index) {
        if (index >= 0 && index < this.customers.length && index < this.markers.length) {
            const customer = this.customers[index];
            const marker = this.markers[index];
            
            // Center map on customer and zoom in
            this.map.setView([customer.latitude, customer.longitude], 15);
            
            // Open popup
            if (marker) {
                marker.openPopup();
            }
        }
    }

    updateCustomerCount() {
        const customerCount = document.getElementById('customerCount');
        customerCount.textContent = `Total Customers: ${this.customers.length}`;
    }

    async saveToLocalStorage() {
        try {
            // For large datasets, we need to be careful with localStorage limits
            const dataString = JSON.stringify(this.customers);
            const sizeInMB = new Blob([dataString]).size / (1024 * 1024);
            
            console.log(`Data size: ${sizeInMB.toFixed(2)} MB`);
            
            if (sizeInMB > 5) { // localStorage typically has 5-10MB limit
                // Save only essential data for large datasets
                const essentialData = this.customers.map(customer => ({
                    accno: customer.accno,
                    name: customer.name,
                    longitude: customer.longitude,
                    latitude: customer.latitude
                }));
                localStorage.setItem('customerMapData', JSON.stringify(essentialData));
                localStorage.setItem('isEssentialData', 'true');
                console.log('Saved essential data due to size constraints');
            } else {
                localStorage.setItem('customerMapData', dataString);
                localStorage.setItem('isEssentialData', 'false');
                console.log('Saved complete data to localStorage');
            }
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
            // Try saving essential data only
            try {
                const essentialData = this.customers.map(customer => ({
                    accno: customer.accno,
                    name: customer.name,
                    longitude: customer.longitude,
                    latitude: customer.latitude
                }));
                localStorage.setItem('customerMapData', JSON.stringify(essentialData));
                localStorage.setItem('isEssentialData', 'true');
                console.log('Saved essential data as fallback');
            } catch (fallbackError) {
                console.error('Failed to save even essential data:', fallbackError);
                this.showError('Warning: Unable to save data to browser storage. Data will be lost on page refresh.');
            }
        }
    }

    checkStoredData() {
        try {
            const storedData = localStorage.getItem('customerMapData');
            if (storedData) {
                this.customers = JSON.parse(storedData);
                if (this.customers.length > 0) {
                    console.log(`Loaded ${this.customers.length} customers from localStorage`);
                    this.showMapPage();
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to load data from localStorage:', error);
            localStorage.removeItem('customerMapData');
            localStorage.removeItem('isEssentialData');
        }
        
        // Show home page if no valid stored data
        this.showHomePage();
    }

    clearStoredData() {
        if (confirm('Are you sure you want to clear all customer data? This action cannot be undone.')) {
            localStorage.removeItem('customerMapData');
            localStorage.removeItem('isEssentialData');
            this.customers = [];
            
            if (this.map) {
                this.markers.forEach(marker => this.map.removeLayer(marker));
                this.markers = [];
            }
            
            this.showHomePage();
            
            // Close menu
            document.getElementById('burgerIcon').classList.remove('active');
            document.getElementById('menuContent').classList.remove('active');
        }
    }

    showHomePage() {
        document.getElementById('homePage').style.display = 'flex';
        document.getElementById('mapPage').style.display = 'none';
        
        // Reset file input
        document.getElementById('fileInput').value = '';
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        if (!show) {
            this.updateProgress(0);
        }
    }

    updateProgress(percentage) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar && progressText) {
            progressBar.style.width = percentage + '%';
            progressText.textContent = percentage + '%';
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    new CustomerMapApp();
});
