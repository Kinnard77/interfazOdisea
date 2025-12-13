// Enhanced Destinations Page Functions

// Initialize enhanced features for destinations page
function initializeDestinationsEnhanced() {
    initializeAdvancedFilters();
    initializeRealTimeSearch();
    initializeInteractiveComparison();
    initializeDestinationMap();
    initializeTouchGestures();
    initializeAdvancedAnimations();
}

// Advanced filtering with real-time updates
function initializeAdvancedFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const priceRange = document.getElementById('price-range');
    const durationFilters = document.querySelectorAll('.duration-filter');
    const ratingFilters = document.querySelectorAll('.rating-filter');
    
    // Add smooth transitions to filter changes
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Animate button transition
            anime({
                targets: this,
                scale: [0.95, 1],
                duration: 200,
                easing: 'easeOutExpo'
            });
            
            // Update active state with animation
            filterButtons.forEach(b => {
                if (b !== this) {
                    anime({
                        targets: b,
                        backgroundColor: 'rgba(13, 79, 76, 0.1)',
                        color: '#0D4F4C',
                        duration: 300
                    });
                }
            });
            
            anime({
                targets: this,
                backgroundColor: '#0D4F4C',
                color: '#FFFFFF',
                duration: 300
            });
        });
    });
    
    // Price range with smooth value updates
    if (priceRange) {
        priceRange.addEventListener('input', function() {
            const value = this.value;
            const priceValue = document.getElementById('price-value');
            
            // Animate price value change
            anime({
                targets: priceValue,
                scale: [1.1, 1],
                duration: 200,
                easing: 'easeOutExpo',
                complete: () => {
                    priceValue.textContent = value == 5000 ? '$5000+' : `$${value}`;
                }
            });
        });
    }
    
    // Duration filters with visual feedback
    durationFilters.forEach(filter => {
        filter.addEventListener('change', function() {
            const label = this.parentElement;
            
            if (this.checked) {
                anime({
                    targets: label,
                    backgroundColor: 'rgba(224, 122, 95, 0.1)',
                    duration: 300
                });
            } else {
                anime({
                    targets: label,
                    backgroundColor: 'transparent',
                    duration: 300
                });
            }
        });
    });
}

// Real-time search with advanced autocomplete
function initializeRealTimeSearch() {
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            
            // Add loading animation
            this.style.background = 'linear-gradient(90deg, #f0f0f0 50%, #e0e0e0 100%)';
            this.style.backgroundSize = '200% 100%';
            
            searchTimeout = setTimeout(() => {
                const query = this.value.toLowerCase().trim();
                
                if (query.length >= 2) {
                    // Simulate API call delay
                    anime({
                        targets: this,
                        backgroundPosition: '200% 0',
                        duration: 500,
                        complete: () => {
                            this.style.background = '';
                            performAdvancedSearch(query);
                        }
                    });
                } else {
                    this.style.background = '';
                    clearSearchResults();
                }
            }, 300);
        });
        
        // Add focus effects
        searchInput.addEventListener('focus', function() {
            anime({
                targets: this,
                borderColor: '#E07A5F',
                boxShadow: '0 0 0 3px rgba(224, 122, 95, 0.1)',
                duration: 300
            });
        });
        
        searchInput.addEventListener('blur', function() {
            anime({
                targets: this,
                borderColor: '#d1d5db',
                boxShadow: 'none',
                duration: 300
            });
        });
    }
}

// Perform advanced search
function performAdvancedSearch(query) {
    // Filter destinations based on multiple criteria
    const filtered = allDestinations.filter(dest => {
        return (
            dest.name.toLowerCase().includes(query) ||
            dest.location.toLowerCase().includes(query) ||
            dest.description.toLowerCase().includes(query) ||
            dest.highlights.some(h => h.toLowerCase().includes(query)) ||
            dest.type.toLowerCase().includes(query)
        );
    });
    
    // Update results with animation
    updateSearchResults(filtered);
    
    // Show search statistics
    showSearchStats(filtered.length, query);
}

// Update search results with smooth animations
function updateSearchResults(results) {
    const grid = document.getElementById('packages-grid');
    const noResults = document.getElementById('no-results');
    
    // Animate out current results
    anime({
        targets: '.package-card',
        opacity: 0,
        translateY: -20,
        duration: 300,
        complete: () => {
            if (results.length === 0) {
                grid.innerHTML = '';
                noResults.classList.remove('hidden');
            } else {
                noResults.classList.add('hidden');
                displayPackages(results);
            }
        }
    });
}

// Show search statistics
function showSearchStats(count, query) {
    const statsElement = document.getElementById('search-stats');
    if (!statsElement) {
        const searchContainer = document.getElementById('search-input').parentElement;
        const stats = document.createElement('div');
        stats.id = 'search-stats';
        stats.className = 'text-sm text-gray-600 mt-2';
        searchContainer.appendChild(stats);
    }
    
    const statsText = `Found ${count} destination${count !== 1 ? 's' : ''} for "${query}"`;
    
    anime({
        targets: '#search-stats',
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: 400,
        easing: 'easeOutExpo',
        complete: () => {
            document.getElementById('search-stats').textContent = statsText;
        }
    });
}

// Clear search results
function clearSearchResults() {
    const statsElement = document.getElementById('search-stats');
    if (statsElement) {
        anime({
            targets: statsElement,
            opacity: 0,
            duration: 200,
            complete: () => statsElement.remove()
        });
    }
}

// Interactive comparison functionality
function initializeInteractiveComparison() {
    const compareBtn = document.getElementById('compare-btn');
    let compareList = [];
    
    // Update compare button state
    function updateCompareButton() {
        const count = compareList.length;
        const compareCount = document.getElementById('compare-count');
        
        if (compareCount) {
            anime({
                targets: compareCount,
                scale: [1.2, 1],
                duration: 300,
                easing: 'easeOutExpo',
                complete: () => {
                    compareCount.textContent = count;
                }
            });
        }
        
        if (compareBtn) {
            compareBtn.disabled = count === 0;
            if (count > 0) {
                compareBtn.classList.add('glow-pulse');
            } else {
                compareBtn.classList.remove('glow-pulse');
            }
        }
    }
    
    // Enhanced toggle compare function
    window.toggleCompare = function(packageId) {
        const index = compareList.indexOf(packageId);
        
        if (index > -1) {
            compareList.splice(index, 1);
            showNotification('Removed from comparison', 'info');
        } else {
            if (compareList.length < 3) {
                compareList.push(packageId);
                showNotification('Added to comparison', 'success');
                
                // Animate the compare button
                anime({
                    targets: compareBtn,
                    scale: [1.1, 1],
                    duration: 300,
                    easing: 'easeOutExpo'
                });
            } else {
                showNotification('Maximum 3 packages can be compared', 'warning');
                return;
            }
        }
        
        updateCompareButton();
        
        // Update the compare button in the package card
        const compareBtns = document.querySelectorAll(`[onclick="toggleCompare(${packageId})"]`);
        compareBtns.forEach(btn => {
            const isInCompare = compareList.includes(packageId);
            btn.textContent = isInCompare ? '✓ Added' : '+ Compare';
            btn.className = isInCompare ? 
                'compare-btn bg-primary text-white px-3 py-1 rounded-full text-sm font-medium hover:bg-opacity-100 transition-all' :
                'compare-btn bg-white bg-opacity-90 text-gray-700 px-3 py-1 rounded-full text-sm font-medium hover:bg-opacity-100 transition-all';
        });
    };
    
    // Enhanced comparison modal
    window.showComparison = function() {
        if (compareList.length === 0) return;
        
        const modal = document.getElementById('comparison-modal');
        const content = document.getElementById('comparison-content');
        
        const comparePackages = allDestinations.filter(dest => compareList.includes(dest.id));
        
        content.innerHTML = createEnhancedComparisonTable(comparePackages);
        modal.classList.remove('hidden');
        
        // Animate modal appearance
        anime({
            targets: modal,
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutExpo'
        });
        
        anime({
            targets: modal.querySelector('.comparison-table'),
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 400,
            delay: 100,
            easing: 'easeOutExpo'
        });
    };
    
    // Initialize compare button
    updateCompareButton();
}

// Create enhanced comparison table
function createEnhancedComparisonTable(packages) {
    return `
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b">
                        <th class="text-left py-4 px-4 font-semibold">Feature</th>
                        ${packages.map(pkg => `<th class="text-center py-4 px-4 font-semibold min-w-[200px]">${pkg.name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Image</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center">
                            <img src="${pkg.image}" alt="${pkg.name}" class="w-24 h-24 object-cover rounded-lg mx-auto hover:scale-110 transition-transform">
                        </td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Location</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center font-medium">${pkg.location}</td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Price</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center font-bold text-primary text-xl">${pkg.priceDisplay}</td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Duration</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center">${pkg.duration}</td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Rating</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center text-lg">⭐ ${pkg.rating}</td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Best Time</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center text-sm">${pkg.bestTime}</td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Group Size</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center">${pkg.groupSize}</td>`).join('')}
                    </tr>
                    <tr class="border-b">
                        <td class="py-4 px-4 font-medium">Highlights</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center">
                            <ul class="text-sm space-y-1">
                                ${pkg.highlights.slice(0, 3).map(h => `<li>• ${h}</li>`).join('')}
                            </ul>
                        </td>`).join('')}
                    </tr>
                    <tr>
                        <td class="py-4 px-4 font-medium">Actions</td>
                        ${packages.map(pkg => `<td class="py-4 px-4 text-center">
                            <div class="space-y-2">
                                <button onclick="handleBooking(${pkg.id})" class="btn-primary w-full py-2 rounded-lg text-sm font-semibold">
                                    Reservar Ahora
                                </button>
                                <button onclick="showPackageDetails(${pkg.id})" class="block w-full text-primary text-sm hover:underline">
                                    Ver Detalles
                                </button>
                                <button onclick="toggleCompare(${pkg.id})" class="block w-full text-gray-500 text-sm hover:text-primary">
                                    Quitar de Comparación
                                </button>
                            </div>
                        </td>`).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="mt-6 text-center">
            <button onclick="closeComparison()" class="btn-secondary px-6 py-2 rounded-lg font-medium">
                Cerrar Comparación
            </button>
        </div>
    `;
}

// Initialize destination map
function initializeDestinationMap() {
    const mapContainer = document.getElementById('destination-map');
    if (mapContainer && typeof L !== 'undefined') {
        // Initialize Leaflet map if available
        const map = L.map('destination-map').setView([20, 0], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add destination markers
        allDestinations.forEach(dest => {
            const marker = L.marker([Math.random() * 160 - 80, Math.random() * 360 - 180])
                .addTo(map)
                .bindPopup(`
                    <div class="text-center">
                        <img src="${dest.image}" alt="${dest.name}" class="w-20 h-20 object-cover rounded-lg mb-2">
                        <h4 class="font-semibold">${dest.name}</h4>
                        <p class="text-sm text-gray-600">${dest.location}</p>
                        <p class="text-primary font-semibold">${dest.priceDisplay}</p>
                    </div>
                `);
        });
    }
}

// Initialize touch gestures
function initializeTouchGestures() {
    let startX, startY, endX, endY;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', function(e) {
        endX = e.changedTouches[0].clientX;
        endY = e.changedTouches[0].clientY;
        
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Swipe gestures for mobile
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 50) {
                // Swipe left - next page or filter
                handleSwipeLeft();
            } else if (diffX < -50) {
                // Swipe right - previous page or filter
                handleSwipeRight();
            }
        }
    });
}

// Handle swipe gestures
function handleSwipeLeft() {
    // Could implement next filter or page
    showNotification('Swipe left detected', 'info');
}

function handleSwipeRight() {
    // Could implement previous filter or page
    showNotification('Swipe right detected', 'info');
}

// Advanced animations for destinations
function initializeAdvancedAnimations() {
    // Staggered entrance animations for package cards
    const packageCards = document.querySelectorAll('.package-card');
    packageCards.forEach((card, index) => {
        card.classList.add(`stagger-${(index % 5) + 1}`);
    });
    
    // Add hover sound effects (visual feedback)
    packageCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            // Add subtle vibration effect on supported devices
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
            
            // Add visual feedback
            anime({
                targets: this,
                boxShadow: '0 25px 50px rgba(13, 79, 76, 0.2)',
                duration: 300
            });
        });
        
        card.addEventListener('mouseleave', function() {
            anime({
                targets: this,
                boxShadow: '0 10px 30px rgba(13, 79, 76, 0.1)',
                duration: 300
            });
        });
    });
}

// Enhanced notification system
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `fixed top-24 right-6 z-50 px-6 py-4 rounded-lg shadow-lg text-white font-medium max-w-sm`;
    
    // Different styles for different notification types
    switch (type) {
        case 'success':
            notification.classList.add('bg-green-500');
            notification.innerHTML = `✓ ${message}`;
            break;
        case 'error':
            notification.classList.add('bg-red-500');
            notification.innerHTML = `✗ ${message}`;
            break;
        case 'warning':
            notification.classList.add('bg-yellow-500');
            notification.innerHTML = `⚠ ${message}`;
            break;
        case 'info':
        default:
            notification.classList.add('bg-blue-500');
            notification.innerHTML = `ℹ ${message}`;
            break;
    }
    
    document.body.appendChild(notification);
    
    // Animate in with bounce effect
    anime({
        targets: notification,
        translateX: [300, 0],
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 500,
        easing: 'easeOutBounce'
    });
    
    // Auto remove with slide out
    setTimeout(() => {
        anime({
            targets: notification,
            translateX: 300,
            opacity: 0,
            scale: 0.8,
            duration: 300,
            easing: 'easeInExpo',
            complete: () => notification.remove()
        });
    }, duration);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDestinationsEnhanced);
} else {
    initializeDestinationsEnhanced()