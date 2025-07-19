class CustomerMapApp {
    constructor() {
        this.customers = [];
        this.map = null;
        this.markers = [];
        this.requiredColumns = ['accno', 'name', 'longitude', 'lattitude'];
        
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
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                           'application/vnd.ms-excel'];
        
        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
            this.showError('Please upload a valid Excel file (.xlsx or .xls)');
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const data = await this.readExcelFile(file);
            const validatedData = this.validateData(data);
            
            if (validatedData.length === 0) {
                throw new Error('No valid customer data found with required columns and coordinates');
            }

            this.customers = validatedData;
            this.saveToLocalStorage();
            this.showMapPage();
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('Failed to read Excel file. Please ensure it\'s a valid Excel file.'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read the file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    validateData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Excel file is empty or invalid');
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

        // Filter and validate data
        const validCustomers = data.filter(row => {
            const accno = this.getColumnValue(row, 'accno');
            const name = this.getColumnValue(row, 'name');
            const longitude = this.getColumnValue(row, 'longitude');
            const latitude = this.getColumnValue(row, 'lattitude');

            // Check if required fields exist and coordinates are valid
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
        document.getElementById('homePage').style.display = 'none';
        document.getElementById('mapPage').style.display = 'block';
        
        // Initialize map if not already done
        if (!this.map) {
            this.initializeMap();
        }
        
        this.displayCustomersOnMap();
        this.updateCustomerList();
        this.updateCustomerCount();
    }

    initializeMap() {
        this.map = L.map('map').setView([24.5854, 73.7125], 6); // Default to Rajasthan, India

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
    }

    displayCustomersOnMap() {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        if (this.customers.length === 0) return;

        // Add markers for each customer
        const bounds = [];
        
        this.customers.forEach(customer => {
            const marker = L.marker([customer.latitude, customer.longitude])
                .addTo(this.map);
            
            // Create popup content
            const popupContent = this.createPopupContent(customer);
            marker.bindPopup(popupContent);
            
            this.markers.push(marker);
            bounds.push([customer.latitude, customer.longitude]);
        });

        // Fit map to show all markers
        if (bounds.length > 0) {
            this.map.fitBounds(bounds, { padding: [20, 20] });
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

        // Add customer items
        this.customers.forEach((customer, index) => {
            const item = document.createElement('div');
            item.className = 'customer-item';
            item.textContent = `${customer.accno} - ${customer.name}`;
            item.addEventListener('click', () => {
                this.focusOnCustomer(index);
                // Close menu
                document.getElementById('burgerIcon').classList.remove('active');
                document.getElementById('menuContent').classList.remove('active');
            });
            customerList.appendChild(item);
        });
    }

    focusOnCustomer(index) {
        if (index >= 0 && index < this.customers.length && index < this.markers.length) {
            const customer = this.customers[index];
            const marker = this.markers[index];
            
            // Center map on customer and zoom in
            this.map.setView([customer.latitude, customer.longitude], 15);
            
            // Open popup
            marker.openPopup();
        }
    }

    updateCustomerCount() {
        const customerCount = document.getElementById('customerCount');
        customerCount.textContent = `Total Customers: ${this.customers.length}`;
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('customerMapData', JSON.stringify(this.customers));
            console.log('Data saved to localStorage');
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
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
        }
        
        // Show home page if no valid stored data
        this.showHomePage();
    }

    clearStoredData() {
        if (confirm('Are you sure you want to clear all customer data? This action cannot be undone.')) {
            localStorage.removeItem('customerMapData');
            this.customers = [];
            this.markers.forEach(marker => this.map.removeLayer(marker));
            this.markers = [];
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
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CustomerMapApp();
});
