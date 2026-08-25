/**
 * Enhanced QR Code Generator Application
 * Features: JSON form handling, QR code generation with custom styling,
 * URL parameter support, and download functionality
 */

/* global QRCodeStyling */

class QRCodeGenerator {
    constructor() {
        this.qrCodeStyling = null;
        this.currentQRCode = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.parseURLParameters();
        this.updateJSONPreview();
    }

    bindEvents() {
        // Form submission
        const form = document.getElementById('qrForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateQRCode();
        });

        // Real-time JSON preview updates
        const formInputs = form.querySelectorAll('input, textarea');
        formInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateJSONPreview();
                this.updateShareURL();
            });
        });

        // Download button
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.addEventListener('click', () => {
            this.downloadQRCode();
        });

        // Copy URL button
        const copyUrlBtn = document.getElementById('copyUrlBtn');
        copyUrlBtn.addEventListener('click', () => {
            this.copyShareURL();
        });
    }

    parseURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const jsonData = urlParams.get('jsondata');
        
        if (jsonData) {
            try {
                // Decode URL-safe base64
                const decodedData = atob(jsonData.replace(/-/g, '+').replace(/_/g, '/'));
                const parsedData = JSON.parse(decodedData);
                
                // Populate form fields
                this.populateForm(parsedData);
                
                // Auto-generate QR code
                setTimeout(() => {
                    this.generateQRCode();
                }, 100);
                
            } catch (error) {
                console.error('Error parsing URL parameters:', error);
                this.showNotification('Invalid URL parameters', 'error');
            }
        }
    }

    populateForm(data) {
        const fields = ['title', 'url', 'description', 'iconUrl', 'themeColor'];
        
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && data[field] !== undefined) {
                element.value = data[field];
            }
        });
        
        this.updateJSONPreview();
    }

    getFormData() {
        return {
            title: document.getElementById('title').value.trim(),
            url: document.getElementById('url').value.trim(),
            description: document.getElementById('description').value.trim(),
            iconUrl: document.getElementById('iconUrl').value.trim(),
            themeColor: document.getElementById('themeColor').value
        };
    }

    updateJSONPreview() {
        const data = this.getFormData();
        const jsonPreview = document.getElementById('jsonPreview');
        jsonPreview.textContent = JSON.stringify(data, null, 2);
    }

    updateShareURL() {
        const data = this.getFormData();
        
        // Check if form has any data
        const hasData = Object.values(data).some(value => value && value !== '#FE5000');
        
        if (hasData) {
            try {
                const jsonString = JSON.stringify(data);
                // Create URL-safe base64 encoding
                const encodedData = btoa(jsonString)
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
                
                const shareUrl = `${window.location.origin}${window.location.pathname}?jsondata=${encodedData}`;
                document.getElementById('shareUrl').value = shareUrl;
            } catch (error) {
                console.error('Error creating share URL:', error);
                document.getElementById('shareUrl').value = '';
            }
        } else {
            document.getElementById('shareUrl').value = '';
        }
    }

    async generateQRCode() {
        const data = this.getFormData();
        
        // Validate required fields
        if (!data.title && !data.url && !data.description) {
            this.showNotification('Please fill in at least one field', 'warning');
            return;
        }

        try {
            // Show loading state
            this.showLoading(true);
            
            // Clear existing QR code
            const qrCodeContainer = document.getElementById('qrCode');
            qrCodeContainer.innerHTML = '';
            
            // Hide placeholder
            document.getElementById('qrPlaceholder').style.display = 'none';
            
            // Create JSON string for QR code
            const qrData = JSON.stringify(data);
            
            // Configure QR code with custom styling
            const qrCodeOptions = {
                width: 300,
                height: 300,
                type: "canvas",
                data: qrData,
                margin: 10,
                qrOptions: {
                    typeNumber: 0, // Auto-detect
                    mode: "Byte",
                    errorCorrectionLevel: "L" // Lowest error correction for maximum data
                },
                imageOptions: {
                    hideBackgroundDots: true,
                    imageSize: 0.4,
                    margin: 20,
                    crossOrigin: "anonymous"
                },
                dotsOptions: {
                    color: "#000000", // Black pixels
                    type: "rounded"
                },
                backgroundOptions: {
                    color: "#ffffff" // White background
                },
                cornersSquareOptions: {
                    color: "#000000",
                    type: "extra-rounded"
                },
                cornersDotOptions: {
                    color: "#000000",
                    type: "dot"
                }
            };

            // Create QR code instance
            this.currentQRCode = new QRCodeStyling(qrCodeOptions);
            
            // Create wrapper div for custom styling
            const wrapper = document.createElement('div');
            wrapper.className = 'qr-code-wrapper fade-in';
            
            // Append QR code to wrapper
            this.currentQRCode.append(wrapper);
            
            // Add wrapper to container
            qrCodeContainer.appendChild(wrapper);
            
            // Show download section
            document.getElementById('downloadSection').classList.remove('hidden');
            
            // Update share URL
            this.updateShareURL();
            
            this.showNotification('QR Code generated successfully!', 'success');
            
        } catch (error) {
            console.error('Error generating QR code:', error);
            this.showNotification('Error generating QR code. Please try again.', 'error');
            
            // Show placeholder again
            document.getElementById('qrPlaceholder').style.display = 'flex';
        } finally {
            this.showLoading(false);
        }
    }

    downloadQRCode() {
        if (!this.currentQRCode) {
            this.showNotification('No QR code to download', 'warning');
            return;
        }

        try {
            // Create canvas for custom styling
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size (larger for better quality)
            const size = 400;
            const padding = 30;
            const borderWidth = 4;
            
            canvas.width = size + (padding * 2);
            canvas.height = size + (padding * 2) + 30; // Extra space for text
            
            // Fill white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw orange rounded border
            ctx.strokeStyle = '#FE5000';
            ctx.lineWidth = borderWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            const borderRadius = 15;
            const x = borderWidth / 2;
            const y = borderWidth / 2;
            const width = canvas.width - borderWidth;
            const height = canvas.height - 30 - borderWidth; // Account for text space
            
            // Draw rounded rectangle border
            ctx.beginPath();
            ctx.moveTo(x + borderRadius, y);
            ctx.lineTo(x + width - borderRadius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
            ctx.lineTo(x + width, y + height - borderRadius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
            ctx.lineTo(x + borderRadius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
            ctx.lineTo(x, y + borderRadius);
            ctx.quadraticCurveTo(x, y, x + borderRadius, y);
            ctx.closePath();
            ctx.stroke();
            
            // Get QR code canvas
            const qrCanvas = document.querySelector('#qrCode canvas');
            if (qrCanvas) {
                // Draw QR code
                ctx.drawImage(qrCanvas, padding, padding, size, size);
            }
            
            // Add "r1 creations" text
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('r1 creations', canvas.width / 2, canvas.height - 10);
            
            // Download the image
            const link = document.createElement('a');
            link.download = 'qr-code-enhanced.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            this.showNotification('QR Code downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error downloading QR code:', error);
            
            // Fallback to library's download method
            if (this.currentQRCode) {
                this.currentQRCode.download({
                    name: "qr-code-enhanced",
                    extension: "png"
                });
            }
        }
    }

    copyShareURL() {
        const shareUrlInput = document.getElementById('shareUrl');
        const url = shareUrlInput.value;
        
        if (!url) {
            this.showNotification('No URL to copy', 'warning');
            return;
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            this.showNotification('URL copied to clipboard!', 'success');
            
            // Visual feedback
            const copyBtn = document.getElementById('copyUrlBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.backgroundColor = '#10b981';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
            
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
            
            // Fallback selection method
            shareUrlInput.select();
            shareUrlInput.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                this.showNotification('URL copied to clipboard!', 'success');
            } catch {
                this.showNotification('Could not copy URL', 'error');
            }
        });
    }

    showLoading(show) {
        const qrCodeContainer = document.getElementById('qrCode');
        
        if (show) {
            qrCodeContainer.classList.add('loading');
        } else {
            qrCodeContainer.classList.remove('loading');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} fade-in`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QRCodeGenerator();
});

// Handle page visibility changes to update share URLs
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible, update share URL if needed
        const generator = window.qrGenerator;
        if (generator) {
            generator.updateShareURL();
        }
    }
});

// Export for global access if needed
window.QRCodeGenerator = QRCodeGenerator;