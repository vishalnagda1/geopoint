class CustomerMapApp {
    constructor() {
        this.customers = [];
        this.filteredCustomers = [];
        this.map = null;
        this.markerClusterGroup = null;
        this.markersMap = new Map(); // Store markers by customer ID for quick lookup
        this.requiredColumns = ['accno', 'name', 'longitude', 'lattitude'];
        this.batchSize = 1000; // Process 1000 records at a time
        this.selectedCustomerIndex = -1; // Track selected customer
        this.renderBatchSize = 100; // Render markers in smaller batches
        this.visibleCustomerItems = []; // Track visible customer list items
        this.searchTimeout = null;
        
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

        // Search functionality
        const searchInput = document.getElementById('customerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch.bind(this));
        }

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

    handleSearch(e) {
        // Debounce search to avoid too many calls
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase().trim();
            this.filterCustomers(searchTerm);
        }, 300);
    }

    filterCustomers(searchTerm) {
        if (!searchTerm) {
            this.filteredCustomers = this.customers.slice(0, 50); // Show only first 50 by default
        } else {
            this.filteredCustomers = this.customers.filter(customer => 
                customer.accno.toLowerCase().includes(searchTerm) ||
                customer.name.toLowerCase().includes(searchTerm)
            ).slice(0, 50); // Limit search results to 50
        }
        this.updateCustomerList();
        
        // If there's exactly one result, auto-focus on it
        if (this.filteredCustomers.length === 1) {
            const customer = this.filteredCustomers[0];
            const originalIndex = this.customers.indexOf(customer);
            setTimeout(() => {
                this.focusOnCustomer(originalIndex);
            }, 500);
        }
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
            this.filteredCustomers = validatedData.slice(0, 50); // Show only first 50 initially
            
            // Store original count for display purposes
            localStorage.setItem('originalRecordCount', data.length.toString());
            
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
        const invalidRecords = [];
        const totalBatches = Math.ceil(data.length / this.batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * this.batchSize;
            const end = Math.min(start + this.batchSize, data.length);
            const batch = data.slice(start, end);
            
            batch.forEach(row => {
                const accno = this.getColumnValue(row, 'accno');
                const name = this.getColumnValue(row, 'name');
                const longitude = this.getColumnValue(row, 'longitude');
                const latitude = this.getColumnValue(row, 'lattitude');

                // Log detailed validation info
                const validationInfo = {
                    accno: accno,
                    name: name,
                    hasAccno: !!accno,
                    hasName: !!name,
                    longitude: longitude,
                    latitude: latitude,
                    hasValidLongitude: this.isValidCoordinate(longitude, -180, 180),
                    hasValidLatitude: this.isValidCoordinate(latitude, -90, 90)
                };

                if (accno && name && 
                    this.isValidCoordinate(longitude, -180, 180) && 
                    this.isValidCoordinate(latitude, -90, 90)) {
                    
                    // Valid record
                    validCustomers.push({
                        accno: accno,
                        name: name,
                        longitude: parseFloat(longitude),
                        latitude: parseFloat(latitude),
                        tariffcode: this.getColumnValue(row, 'tariffcode') || '',
                        kworhp: this.getColumnValue(row, 'kworhp') || '',
                        consumerstatus: this.getColumnValue(row, 'consumerstatus') || '',
                        phase: this.getColumnValue(row, 'phase') || '',
                        meterno: this.getColumnValue(row, 'meterno') || '',
                        consumption: this.getColumnValue(row, 'consumption') || '',
                        rdngmonth: this.getColumnValue(row, 'rdngmonth') || ''
                    });
                    console.log(`✅ Valid record: ${accno} - ${name}`);
                } else {
                    // Invalid record - log why it failed
                    invalidRecords.push(validationInfo);
                    let reason = [];
                    if (!accno) reason.push('missing account number');
                    if (!name) reason.push('missing name');
                    if (!this.isValidCoordinate(longitude, -180, 180)) reason.push(`invalid longitude (${longitude})`);
                    if (!this.isValidCoordinate(latitude, -90, 90)) reason.push(`invalid latitude (${latitude})`);
                    
                    console.log(`❌ Invalid record: ${accno || 'NO_ACCNO'} - ${name || 'NO_NAME'} | Reason: ${reason.join(', ')}`);
                }
            });
            
            // Update progress
            const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
            this.updateProgress(progress);
            
            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`\n📊 VALIDATION SUMMARY:`);
        console.log(`Total records processed: ${data.length}`);
        console.log(`Valid records (with coordinates): ${validCustomers.length}`);
        console.log(`Invalid records (missing coordinates): ${invalidRecords.length}`);
        
        if (invalidRecords.length > 0) {
            console.log(`\n❌ Records without coordinates:`);
            invalidRecords.forEach(record => {
                console.log(`   ${record.accno} - ${record.name} (lon: "${record.longitude}", lat: "${record.latitude}")`);
            });
        }

        return validCustomers;
    }

    getColumnValue(row, columnName) {
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
            this.map = L.map('map', {
                center: [24.5854, 73.7125],
                zoom: 6,
                zoomControl: true,
                scrollWheelZoom: true,
                preferCanvas: true // Use canvas renderer for better performance
            });

            console.log('Adding tile layer...');
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                minZoom: 3
            }).addTo(this.map);

            // Initialize marker cluster group with better settings
            this.markerClusterGroup = L.markerClusterGroup({
                chunkedLoading: true,
                chunkInterval: 100,
                chunkDelay: 25,
                maxClusterRadius: 40, // Smaller cluster radius for better precision
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                spiderfyDistanceMultiplier: 1.5,
                iconCreateFunction: function(cluster) {
                    const count = cluster.getChildCount();
                    let className = 'marker-cluster-small';
                    if (count > 100) className = 'marker-cluster-large';
                    else if (count > 10) className = 'marker-cluster-medium';
                    
                    return new L.DivIcon({
                        html: '<div><span>' + count + '</span></div>',
                        className: 'marker-cluster ' + className,
                        iconSize: new L.Point(40, 40)
                    });
                }
            });
            
            this.map.addLayer(this.markerClusterGroup);

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
        if (!this.map || !this.markerClusterGroup) {
            console.error('Map or cluster group not initialized');
            return;
        }

        console.log(`Displaying ${this.customers.length} customers on map with clustering...`);
        
        // Clear existing markers and map
        this.markerClusterGroup.clearLayers();
        this.markersMap.clear();

        if (this.customers.length === 0) return;

        // Add markers in batches for better performance
        const totalBatches = Math.ceil(this.customers.length / this.renderBatchSize);
        const bounds = [];
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * this.renderBatchSize;
            const end = Math.min(start + this.renderBatchSize, this.customers.length);
            const batch = this.customers.slice(start, end);
            
            const markers = [];
            
            batch.forEach((customer, localIndex) => {
                try {
                    const globalIndex = start + localIndex;
                    const marker = L.marker([customer.latitude, customer.longitude]);
                    
                    // Store customer data in marker for easy access
                    marker.customerData = customer;
                    marker.customerIndex = globalIndex;
                    
                    const popupContent = this.createPopupContent(customer);
                    marker.bindPopup(popupContent);
                    
                    // Store marker in map for quick lookup
                    this.markersMap.set(customer.accno, marker);
                    
                    markers.push(marker);
                    bounds.push([customer.latitude, customer.longitude]);
                } catch (error) {
                    console.error('Error creating marker for customer:', customer.accno, error);
                }
            });
            
            // Add batch of markers to cluster group
            this.markerClusterGroup.addLayers(markers);
            
            // Allow UI to update between batches
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 25));
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

        console.log(`Added ${this.markersMap.size} markers to map`);
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

    // Debug method to find customers by coordinates
    findCustomerByCoordinates(lat, lng, tolerance = 0.0001) {
        return this.customers.find(customer => 
            Math.abs(customer.latitude - lat) < tolerance &&
            Math.abs(customer.longitude - lng) < tolerance
        );
    }

    updateCustomerList() {
        const customerList = document.getElementById('customerList');
        
        // Clear existing items efficiently
        while (customerList.firstChild) {
            customerList.removeChild(customerList.firstChild);
        }

        if (this.filteredCustomers.length === 0 && this.customers.length > 0) {
            const noResults = document.createElement('div');
            noResults.className = 'customer-item';
            noResults.textContent = 'No customers found';
            noResults.style.fontStyle = 'italic';
            noResults.style.pointerEvents = 'none';
            customerList.appendChild(noResults);
            return;
        }

        if (this.filteredCustomers.length === 0) return;

        // Add header
        const header = document.createElement('div');
        header.className = 'menu-item';
        header.innerHTML = `<strong>Customers (${this.filteredCustomers.length} shown):</strong>`;
        header.style.pointerEvents = 'none';
        header.style.background = 'rgba(0, 0, 0, 0.05)';
        customerList.appendChild(header);

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Add customer items
        this.filteredCustomers.forEach((customer, index) => {
            const originalIndex = this.customers.indexOf(customer);
            const item = document.createElement('div');
            item.className = 'customer-item';
            item.textContent = `${customer.accno} - ${customer.name}`;
            
            // Add selected class if this is the selected customer
            if (originalIndex === this.selectedCustomerIndex) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                // Remove selected class from all items
                customerList.querySelectorAll('.customer-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Add selected class to clicked item
                item.classList.add('selected');
                this.selectedCustomerIndex = originalIndex;
                
                this.focusOnCustomer(originalIndex);
                // Close menu
                document.getElementById('burgerIcon').classList.remove('active');
                document.getElementById('menuContent').classList.remove('active');
            });
            
            fragment.appendChild(item);
        });

        customerList.appendChild(fragment);

        // Show info about total customers if filtered
        if (this.filteredCustomers.length < this.customers.length) {
            const infoItem = document.createElement('div');
            infoItem.className = 'customer-item';
            infoItem.textContent = `Total: ${this.customers.length} customers loaded`;
            infoItem.style.fontStyle = 'italic';
            infoItem.style.fontSize = '12px';
            infoItem.style.pointerEvents = 'none';
            infoItem.style.background = 'rgba(0, 0, 0, 0.02)';
            customerList.appendChild(infoItem);
        }
    }

    focusOnCustomer(index) {
        if (index >= 0 && index < this.customers.length) {
            const customer = this.customers[index];
            console.log(`Focusing on customer: ${customer.accno} at ${customer.latitude}, ${customer.longitude}`);
            
            // Center map on customer and zoom in
            this.map.setView([customer.latitude, customer.longitude], 16);
            
            // Find the specific marker for this customer
            const marker = this.markersMap.get(customer.accno);
            if (marker) {
                console.log('Found marker, opening popup');
                
                // If marker is in a cluster, we need to spiderfy first
                const cluster = this.markerClusterGroup.getVisibleParent(marker);
                if (cluster && cluster !== marker) {
                    // Marker is clustered, zoom in more to uncluster it
                    setTimeout(() => {
                        this.map.setView([customer.latitude, customer.longitude], 18);
                        // Try to open popup after zoom
                        setTimeout(() => {
                            marker.openPopup();
                        }, 500);
                    }, 300);
                } else {
                    // Marker is not clustered, open popup directly
                    marker.openPopup();
                }
            } else {
                console.log('Marker not found for customer:', customer.accno);
                // Create a temporary marker if the original isn't found
                const tempMarker = L.marker([customer.latitude, customer.longitude])
                    .addTo(this.map);
                const popupContent = this.createPopupContent(customer);
                tempMarker.bindPopup(popupContent).openPopup();
                
                // Remove temporary marker after 5 seconds
                setTimeout(() => {
                    this.map.removeLayer(tempMarker);
                }, 5000);
            }
        }
    }

    updateCustomerCount() {
        const customerCount = document.getElementById('customerCount');
        const totalProcessed = this.customers.length;
        
        // Get info about how many records were in the original file (if available)
        const originalCount = localStorage.getItem('originalRecordCount');
        
        if (originalCount && parseInt(originalCount) > totalProcessed) {
            customerCount.innerHTML = `
                <div>Valid Customers: ${totalProcessed}</div>
                <div style="font-size: 12px; opacity: 0.8;">
                    ${parseInt(originalCount) - totalProcessed} records excluded (missing coordinates)
                </div>
            `;
        } else {
            customerCount.textContent = `Total Customers: ${totalProcessed}`;
        }
    }

    async saveToLocalStorage() {
        try {
            // For large datasets, save only essential data
            const essentialData = this.customers.map(customer => ({
                accno: customer.accno,
                name: customer.name,
                longitude: customer.longitude,
                latitude: customer.latitude,
                tariffcode: customer.tariffcode,
                consumerstatus: customer.consumerstatus
            }));
            
            localStorage.setItem('customerMapData', JSON.stringify(essentialData));
            localStorage.setItem('isEssentialData', 'true');
            console.log('Saved essential data to localStorage');
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
            this.showError('Warning: Unable to save data to browser storage. Data will be lost on page refresh.');
        }
    }

    checkStoredData() {
        try {
            const storedData = localStorage.getItem('customerMapData');
            if (storedData) {
                this.customers = JSON.parse(storedData);
                this.filteredCustomers = this.customers.slice(0, 50); // Show first 50 initially
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
        
        this.showHomePage();
    }

    clearStoredData() {
        if (confirm('Are you sure you want to clear all customer data? This action cannot be undone.')) {
            localStorage.removeItem('customerMapData');
            localStorage.removeItem('isEssentialData');
            localStorage.removeItem('originalRecordCount');
            this.customers = [];
            this.filteredCustomers = [];
            this.selectedCustomerIndex = -1;
            
            if (this.markerClusterGroup) {
                this.markerClusterGroup.clearLayers();
            }
            this.markersMap.clear();
            
            this.showHomePage();
            
            // Close menu
            document.getElementById('burgerIcon').classList.remove('active');
            document.getElementById('menuContent').classList.remove('active');
        }
    }

    showHomePage() {
        document.getElementById('homePage').style.display = 'flex';
        document.getElementById('mapPage').style.display = 'none';
        
        this.selectedCustomerIndex = -1;
        document.getElementById('fileInput').value = '';
        
        // Clear search
        const searchInput = document.getElementById('customerSearch');
        if (searchInput) {
            searchInput.value = '';
        }
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
