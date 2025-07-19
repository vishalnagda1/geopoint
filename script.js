class CustomerMapApp {
    constructor() {
        this.dbManager = new IndexedDBManager('CustomerDB', 'customers', 1);
        this.filteredCustomers = [];
        this.map = null;
        this.markerClusterGroup = null;
        this.markersMap = new Map(); // Store markers by customer ID for quick lookup
        this.requiredColumns = ['accno', 'name', 'longitude', 'lattitude'];
        this.batchSize = 1000; // Process 1000 records at a time
        this.selectedCustomerAccno = null; // Track selected customer by accno
        this.renderBatchSize = 100; // Render markers in smaller batches
        this.searchTimeout = null;
        this.totalCustomerCount = 0;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkStoredData();
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

    async filterCustomers(searchTerm) {
        if (!searchTerm) {
            this.filteredCustomers = await this.dbManager.getDataSlice(50);
        } else {
            this.filteredCustomers = await this.dbManager.searchData(searchTerm.toLowerCase(), 50);
        }
        this.updateCustomerList();
        
        // If there's exactly one result, auto-focus on it
        if (this.filteredCustomers.length === 1) {
            const customer = this.filteredCustomers[0];
            setTimeout(() => {
                this.focusOnCustomer(customer);
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
        if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
            this.showError('Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)');
            return;
        }

        this.showLoading(true);
        this.hideError();
        this.updateProgress(0);

        try {
            console.log('Starting file processing...');
            let data;
            if (file.name.match(/\.csv$/i)) {
                const csvText = await this.readCSVFile(file);
                console.log('File read successfully, parsing CSV...');
                data = await this.parseCSV(csvText);
            } else {
                console.log('File read successfully, parsing Excel...');
                data = await this.parseExcelFile(file);
            }
            
            console.log(`Parsed ${data.length} rows from file`);
            
            const validatedData = await this.validateDataInBatches(data);
            console.log(`Validated ${validatedData.length} records`);
            
            if (validatedData.length === 0) {
                throw new Error('No valid customer data found with required columns and coordinates');
            }
            
            // Clear old data from DB before adding new
            await this.dbManager.clearData();
            await this.dbManager.addDataInBatches(validatedData);
            this.totalCustomerCount = await this.dbManager.getCount();

            this.filteredCustomers = await this.dbManager.getDataSlice(50);
            
            // Store original count for display purposes
            localStorage.setItem('originalRecordCount', data.length.toString());
            
            console.log('Data saved to IndexedDB, showing map...');
            this.showMapPage(validatedData); // Pass data directly to display
            
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

    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    console.error('Excel parsing error:', error);
                    reject(new Error('Failed to parse Excel file. Please ensure it is not corrupted.'));
                }
            };
            reader.onerror = () => {
                reject(new Error('Failed to read the file'));
            };
            reader.readAsArrayBuffer(file);
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

    showMapPage(customersToDisplay = null) {
        console.log('Showing map page...');
        document.getElementById('homePage').style.display = 'none';
        document.getElementById('mapPage').style.display = 'block';
        
        // Small delay to ensure the map container is visible
        setTimeout(async () => {
            if (!this.map) {
                console.log('Initializing map...');
                this.initializeMap();
            }
            
            // If specific customers are passed (e.g., after upload), display them.
            // Otherwise, load the initial set from the DB.
            const customers = customersToDisplay || await this.dbManager.getDataSlice(5000); // Load up to 5000 markers initially
            
            this.displayCustomersOnMap(customers);
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

    async displayCustomersOnMap(customers) {
        if (!this.map || !this.markerClusterGroup) {
            console.error('Map or cluster group not initialized');
            return;
        }

        console.log(`Displaying ${customers.length} customers on map with clustering...`);
        
        // Clear existing markers and map
        this.markerClusterGroup.clearLayers();
        this.markersMap.clear();

        if (customers.length === 0) return;

        // Add markers in batches for better performance
        const totalBatches = Math.ceil(customers.length / this.renderBatchSize);
        const bounds = [];
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * this.renderBatchSize;
            const end = Math.min(start + this.renderBatchSize, customers.length);
            const batch = customers.slice(start, end);
            
            const markers = [];
            
            batch.forEach((customer) => {
                try {
                    const marker = L.marker([customer.latitude, customer.longitude]);
                    
                    // Store customer data in marker for easy access
                    marker.customerData = customer;
                    
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
        this.filteredCustomers.forEach((customer) => {
            const item = document.createElement('div');
            item.className = 'customer-item';
            item.textContent = `${customer.accno} - ${customer.name}`;
            
            // Add selected class if this is the selected customer
            if (customer.accno === this.selectedCustomerAccno) {
                item.classList.add('selected');
            }
            
            item.addEventListener('click', () => {
                // Remove selected class from all items
                customerList.querySelectorAll('.customer-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Add selected class to clicked item
                item.classList.add('selected');
                this.selectedCustomerAccno = customer.accno;
                
                this.focusOnCustomer(customer);
                // Close menu
                document.getElementById('burgerIcon').classList.remove('active');
                document.getElementById('menuContent').classList.remove('active');
            });
            
            fragment.appendChild(item);
        });

        customerList.appendChild(fragment);

        // Show info about total customers if filtered
        if (this.filteredCustomers.length < this.totalCustomerCount) {
            const infoItem = document.createElement('div');
            infoItem.className = 'customer-item';
            infoItem.textContent = `Total: ${this.totalCustomerCount} customers loaded`;
            infoItem.style.fontStyle = 'italic';
            infoItem.style.fontSize = '12px';
            infoItem.style.pointerEvents = 'none';
            infoItem.style.background = 'rgba(0, 0, 0, 0.02)';
            customerList.appendChild(infoItem);
        }
    }

    focusOnCustomer(customer) {
        if (customer) {
            console.log(`Focusing on customer: ${customer.accno} at ${customer.latitude}, ${customer.longitude}`);
            
            const marker = this.markersMap.get(customer.accno);
            
            if (marker) {
                console.log('Found marker, using zoomToShowLayer to reveal it.');
                
                // This is the correct way to zoom to a marker within a cluster group.
                // It will zoom/pan the map and spiderfy the cluster if needed.
                this.markerClusterGroup.zoomToShowLayer(marker, () => {
                    // This callback is executed after the zoom/spiderfy animation is complete.
                    console.log(`Animation complete for ${customer.accno}, opening popup.`);
                    marker.openPopup();
                });
            } else {
                console.log('Marker not found for customer:', customer.accno);
                // Fallback for cases where the marker might not be in the map (should be rare)
                this.map.setView([customer.latitude, customer.longitude], 18);
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
        const totalProcessed = this.totalCustomerCount;
        
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

    async checkStoredData() {
        try {
            this.totalCustomerCount = await this.dbManager.getCount();
            if (this.totalCustomerCount > 0) {
                this.filteredCustomers = await this.dbManager.getDataSlice(50);
                console.log(`Loaded ${this.totalCustomerCount} customers from IndexedDB`);
                this.showMapPage();
            } else {
                this.showHomePage();
            }
        } catch (error) {
            console.error('Failed to load data from IndexedDB:', error);
            this.showHomePage();
        }
    }

    async clearStoredData() {
        if (confirm('Are you sure you want to clear all customer data? This action cannot be undone.')) {
            await this.dbManager.clearData();
            localStorage.removeItem('originalRecordCount');
            this.filteredCustomers = [];
            this.selectedCustomerAccno = null;
            this.totalCustomerCount = 0;
            
            if (this.markerClusterGroup) {
                this.markerClusterGroup.clearLayers();
            }
            this.markersMap.clear();
            
            this.showHomePage();
            
            // Close menu
            document.getElementById('burgerIcon').classList.remove('active');
            document.getElementById('menuContent').classList.remove('active');
        }
    }    showHomePage() {
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

class IndexedDBManager {
    constructor(dbName, storeName, version) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
        this.db = null;
    }

    async openDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                return resolve(this.db);
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject('IndexedDB error');
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'accno' });
                    // Create indexes for searching
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('accno_lower', 'accno_lower', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
        });
    }

    async addDataInBatches(data) {
        const db = await this.openDB();
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // Add a lowercase version of accno for case-insensitive search
        data.forEach(item => {
            item.accno_lower = item.accno.toLowerCase();
            store.put(item);
        });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = (event) => {
                console.error('Transaction error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async searchData(searchTerm, limit = 50) {
        const db = await this.openDB();
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const results = [];

        return new Promise((resolve) => {
            // Search by account number (case-insensitive)
            const accnoIndex = store.index('accno_lower');
            const accnoRange = IDBKeyRange.bound(searchTerm, searchTerm + '\uffff');
            const accnoRequest = accnoIndex.openCursor(accnoRange);
            
            accnoRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    // Now search by name
                    const nameIndex = store.index('name');
                    const nameRange = IDBKeyRange.bound(searchTerm, searchTerm + '\uffff');
                    const nameRequest = nameIndex.openCursor(nameRange);

                    nameRequest.onsuccess = (e) => {
                        const nameCursor = e.target.result;
                        if (nameCursor && results.length < limit) {
                            // Avoid duplicates
                            if (!results.some(r => r.accno === nameCursor.value.accno)) {
                                results.push(nameCursor.value);
                            }
                            nameCursor.continue();
                        } else {
                            resolve(results);
                        }
                    };
                }
            };
        });
    }

    async getDataSlice(limit = 50) {
        const db = await this.openDB();
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const results = [];

        return new Promise((resolve) => {
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
        });
    }

    async getCount() {
        const db = await this.openDB();
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        return new Promise((resolve) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
        });
    }

    async clearData() {
        const db = await this.openDB();
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.clear();
    }
}
