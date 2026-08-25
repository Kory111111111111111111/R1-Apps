// Main application logic
let currentPage = 'welcome';
let pageModules = {};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeHardwareListeners();
    
    // Check if running as R1 plugin
    if (typeof PluginMessageHandler !== 'undefined') {
        console.log('Running as R1 Creation');
    } else {
        console.log('Running in browser mode');
    }
});

// Navigation system
function initializeNavigation() {
    const menuBtn = document.getElementById('menuBtn');
    const closeMenu = document.getElementById('closeMenu');
    const menuNav = document.getElementById('menuNav');
    const menuLinks = document.querySelectorAll('.menu-nav a');
    
    // Toggle menu
    menuBtn.addEventListener('click', () => {
        menuNav.classList.add('open');
    });
    
    closeMenu.addEventListener('click', () => {
        menuNav.classList.remove('open');
    });
    
    // Handle menu navigation
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            loadPage(page);
            menuNav.classList.remove('open');
            
            // Update active state
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Load page content
async function loadPage(pageName) {
    const content = document.getElementById('content');
    currentPage = pageName;
    
    // Clear current content
    content.innerHTML = '';
    
    // Load page-specific content
    switch(pageName) {
        case 'hardware':
            loadHardwarePage(content);
            break;
        case 'data':
            loadDataPage(content);
            break;
        case 'speak':
            loadSpeakPage(content);
            break;
        default:
            content.innerHTML = '<div class="welcome"><h2>Welcome</h2><p>Select an option from the menu.</p></div>';
    }
}

// Hardware button listeners
function initializeHardwareListeners() {
    // Scroll wheel events
    window.addEventListener('scrollUp', () => {
        if (currentPage === 'hardware' && pageModules.hardware) {
            pageModules.hardware.handleScrollUp();
        }
    });
    
    window.addEventListener('scrollDown', () => {
        if (currentPage === 'hardware' && pageModules.hardware) {
            pageModules.hardware.handleScrollDown();
        }
    });
    
    // PTT button events
    window.addEventListener('sideClick', () => {
        if (currentPage === 'hardware' && pageModules.hardware) {
            pageModules.hardware.handlePTT();
        }
    });
    
    window.addEventListener('longPressStart', () => {
        console.log('Long press started');
    });
    
    window.addEventListener('longPressEnd', () => {
        console.log('Long press ended');
    });
}

// Plugin message handler
window.onPluginMessage = function(data) {
    console.log('Received plugin message:', data);
    
    // Route to appropriate page handler
    if (currentPage === 'data' && pageModules.data) {
        pageModules.data.handleMessage(data);
    } else if (currentPage === 'speak' && pageModules.speak) {
        pageModules.speak.handleMessage(data);
    }
};

// Utility function to update app border color
function updateAppBorderColor(hexColor) {
    const app = document.getElementById('app');
    app.style.borderColor = hexColor;
}