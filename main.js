// Odisea Challenge - Sistema de Reservas de Viajes a CDMX

// Global variables
let particleApp;
let destinations = [
    {
        id: 1,
        name: "Acuario Inbursa",
        location: "CDMX - Polanco",
        price: "$899",
        image: "resources/destination-mountain.jpg",
        type: "acuario",
        rating: 4.8,
        duration: "1 día",
        description: "El acuario más grande de México con más de 5,000 especies marinas"
    },
    {
        id: 2,
        name: "Acuario Interactivo",
        location: "CDMX - Centro",
        price: "$799",
        image: "resources/background-abstract.jpg",
        type: "interactivo",
        rating: 4.7,
        duration: "1 día",
        description: "Experiencia interactiva con tocar rayas y alimentar tiburones"
    },
    {
        id: 3,
        name: "Museo Soumaya",
        location: "CDMX - Polanco",
        price: "$699",
        image: "resources/hero-main.jpg",
        type: "museo",
        rating: 4.9,
        duration: "1 día",
        description: "Museo cultural con la colección privada más importante de arte europeo y mexicano"
    },
    {
        id: 4,
        name: "Odisea México",
        location: "CDMX - Centro",
        price: "$1,199",
        image: "resources/destination-mountain.jpg",
        type: "experiencia",
        rating: 4.8,
        duration: "1 día",
        description: "Experiencia inmersiva única que combina cultura, historia y diversión interactiva"
    }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeParticleBackground();
    initializeAnimations();
    initializeDestinations();
    initializeTestimonials();
    initializeBookingForm();
    initializeTravelTypes();
    initializeScrollAnimations();
    initializeNewsletterForm();
    initializeDestinationSearch();
    initializeEnhancedInteractions();
    initializeTouchOptimizations();
    initializeAdvancedAnimations();
});

// Particle background using p5.js
function initializeParticleBackground() {
    if (typeof p5 !== 'undefined') {
        new p5(function (p) {
            let particles = [];
            let numParticles = 50;

            p.setup = function () {
                let canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent('particle-container');
                canvas.style('position', 'absolute');
                canvas.style('top', '0');
                canvas.style('left', '0');
                canvas.style('z-index', '1');

                // Create particles
                for (let i = 0; i < numParticles; i++) {
                    particles.push({
                        x: p.random(p.width),
                        y: p.random(p.height),
                        vx: p.random(-0.5, 0.5),
                        vy: p.random(-0.5, 0.5),
                        size: p.random(2, 6),
                        opacity: p.random(0.1, 0.3)
                    });
                }
            };

            p.draw = function () {
                p.clear();

                // Update and draw particles
                for (let particle of particles) {
                    particle.x += particle.vx;
                    particle.y += particle.vy;

                    // Wrap around edges
                    if (particle.x < 0) particle.x = p.width;
                    if (particle.x > p.width) particle.x = 0;
                    if (particle.y < 0) particle.y = p.height;
                    if (particle.y > p.height) particle.y = 0;

                    // Draw particle
                    p.fill(255, 255, 255, particle.opacity * 255);
                    p.noStroke();
                    p.ellipse(particle.x, particle.y, particle.size);
                }

                // Draw connections
                for (let i = 0; i < particles.length; i++) {
                    for (let j = i + 1; j < particles.length; j++) {
                        let dist = p.dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                        if (dist < 100) {
                            let alpha = p.map(dist, 0, 100, 0.1, 0);
                            p.stroke(255, 255, 255, alpha * 255);
                            p.strokeWeight(1);
                            p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                        }
                    }
                }
            };

            p.windowResized = function () {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };
        });
    }

    // Initialize animations
    function initializeAnimations() {
        // Animate hero text
        anime({
            targets: '.animate-float',
            translateY: [-20, 0],
            opacity: [0, 1],
            duration: 1500,
            easing: 'easeOutExpo',
            delay: 500
        });

        // Animate booking widget
        anime({
            targets: '.booking-widget',
            translateY: [50, 0],
            opacity: [0, 1],
            duration: 1200,
            easing: 'easeOutExpo',
            delay: 1000
        });

        // Animate navigation
        anime({
            targets: 'nav',
            translateY: [-100, 0],
            opacity: [0, 1],
            duration: 800,
            easing: 'easeOutExpo'
        });
    }

    // Initialize destinations grid
    function initializeDestinations() {
        const grid = document.getElementById('destinations-grid');

        destinations.forEach((dest, index) => {
            const card = document.createElement('div');
            card.className = 'destination-card hover-lift cursor-pointer';
            card.onclick = () => showDestinationDetails(dest);

            card.innerHTML = `
            <div class="relative overflow-hidden">
                <img src="${dest.image}" alt="${dest.name}" class="w-full h-64 object-cover">
                <div class="absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-1 rounded-full text-sm font-semibold">
                    ${dest.price}
                </div>
                <div class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                    ⭐ ${dest.rating}
                </div>
            </div>
            <div class="p-6">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="font-display text-xl font-semibold">${dest.name}</h3>
                    <span class="text-sm text-gray-500">${dest.duration}</span>
                </div>
                <p class="text-gray-600 mb-3">${dest.location}</p>
                <p class="text-sm text-gray-700 leading-relaxed">${dest.description}</p>
                <button class="btn-primary w-full mt-4 py-2 rounded-lg font-semibold">
                    View Details
                </button>
            </div>
        `;

            grid.appendChild(card);

            // Animate card entrance
            anime({
                targets: card,
                translateY: [50, 0],
                opacity: [0, 1],
                duration: 800,
                easing: 'easeOutExpo',
                delay: index * 200
            });
        });
    }

    // Initialize testimonials slider
    function initializeTestimonials() {
        const splide = new Splide('#testimonials-slider', {
            type: 'loop',
            perPage: 1,
            perMove: 1,
            gap: '2rem',
            autoplay: true,
            interval: 5000,
            pauseOnHover: true,
            breakpoints: {
                768: {
                    perPage: 1
                }
            }
        });

        splide.mount();
    }

    // Initialize booking form
    function initializeBookingForm() {
        const form = document.getElementById('booking-form');
        const destinationInput = document.getElementById('destination');
        const checkinInput = document.getElementById('checkin');
        const checkoutInput = document.getElementById('checkout');

        // Set minimum dates
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (checkinInput && checkoutInput) {
            checkinInput.min = today.toISOString().split('T')[0];
            checkoutInput.min = tomorrow.toISOString().split('T')[0];

            // Update checkout minimum when checkin changes
            checkinInput.addEventListener('change', function () {
                const checkinDate = new Date(this.value);
                const nextDay = new Date(checkinDate);
                nextDay.setDate(nextDay.getDate() + 1);
                checkoutInput.min = nextDay.toISOString().split('T')[0];

                if (checkoutInput.value && new Date(checkoutInput.value) <= checkinDate) {
                    checkoutInput.value = nextDay.toISOString().split('T')[0];
                }
            });
        }

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                handleBookingSearch();
            });

            // Destination search with autocomplete
            destinationInput.addEventListener('input', function () {
                showDestinationSuggestions(this.value);
            });
        }

        // Initialize travel type cards
        function initializeTravelTypes() {
            const cards = document.querySelectorAll('.travel-type-card');

            cards.forEach(card => {
                card.addEventListener('click', function () {
                    const type = this.dataset.type;
                    filterDestinationsByType(type);
                });

                // Animate on scroll
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            anime({
                                targets: entry.target,
                                translateY: [30, 0],
                                opacity: [0, 1],
                                duration: 600,
                                easing: 'easeOutExpo'
                            });
                        }
                    });
                });

                observer.observe(card);
            });
        }

        // Initialize scroll animations
        function initializeScrollAnimations() {
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');

                        // Animate elements with stagger effect
                        if (entry.target.classList.contains('destination-card')) {
                            anime({
                                targets: entry.target,
                                translateY: [50, 0],
                                opacity: [0, 1],
                                scale: [0.9, 1],
                                duration: 800,
                                easing: 'easeOutExpo',
                                delay: Math.random() * 200
                            });
                        }

                        // Animate travel type cards with rotation
                        if (entry.target.classList.contains('travel-type-card')) {
                            anime({
                                targets: entry.target,
                                translateY: [30, 0],
                                opacity: [0, 1],
                                rotateX: [10, 0],
                                duration: 600,
                                easing: 'easeOutExpo'
                            });
                        }
                    }
                });
            }, observerOptions);

            // Observe all animatable elements
            document.querySelectorAll('.destination-card, .testimonial-card, .travel-type-card').forEach(el => {
                observer.observe(el);
            });
        }

        // Initialize newsletter form
        function initializeNewsletterForm() {
            const form = document.getElementById('newsletter-form');

            form.addEventListener('submit', function (e) {
                e.preventDefault();

                const email = this.querySelector('input[type="email"]').value;

                // Simulate subscription
                anime({
                    targets: this.querySelector('button'),
                    scale: [1, 0.95, 1],
                    duration: 200,
                    complete: () => {
                        showNotification('¡Gracias por participar! Bienvenido a Odisea Challenge.', 'success');
                        this.reset();
                    }
                });
            });
        }

        // Initialize destination search
        function initializeDestinationSearch() {
            const destinations = [
                'Maldives', 'Switzerland', 'Japan', 'Bali', 'Patagonia', 'Morocco',
                'Paris', 'New York', 'Santorini', 'Dubai', 'London', 'Rome',
                'Bora Bora', 'Kyoto', 'Banff', 'Amalfi Coast', 'Maui', 'Barcelona'
            ];

            window.destinationDatabase = destinations;
        }

        // Show destination suggestions
        function showDestinationSuggestions(query) {
            const suggestions = document.getElementById('destination-suggestions');

            if (query.length < 2) {
                suggestions.classList.add('hidden');
                return;
            }

            const matches = window.destinationDatabase.filter(dest =>
                dest.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 5);

            if (matches.length > 0) {
                suggestions.innerHTML = matches.map(dest =>
                    `<div class="px-4 py-2 hover:bg-gray-100 cursor-pointer" onclick="selectDestination('${dest}')">${dest}</div>`
                ).join('');
                suggestions.classList.remove('hidden');
            } else {
                suggestions.classList.add('hidden');
            }
        }

        // Select destination from suggestions
        function selectDestination(destination) {
            document.getElementById('destination').value = destination;
            document.getElementById('destination-suggestions').classList.add('hidden');
        }

        // Handle booking search
        function handleBookingSearch() {
            const destination = document.getElementById('destination').value;
            const checkin = document.getElementById('checkin').value;
            const checkout = document.getElementById('checkout').value;

            if (!destination || !checkin || !checkout) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            // --- INTEGRACIÓN BACKEND (PRUEBA SOLICITADA) ---
            // Enviaremos los datos al endpoint de creación de viajes como solicitaste.
            // Mapeo de campos: Destination -> City, Checkin -> Departure

            showNotification('Creando viaje en backend...', 'info');

            const payload = {
                city: destination,
                departure_at: new Date(checkin).toISOString(),
                capacity: 40, // Valor fijo de prueba
                price: 500    // Valor fijo de prueba
            };

            fetch('http://localhost:3000/api/v1/viajes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        showNotification(`¡Viaje creado! ID: ${data.trip.id}`, 'success');
                        console.log('Viaje creado:', data.trip);
                        // Opcional: Redirigir o limpiar formulario
                    } else {
                        showNotification(`Error: ${data.error}`, 'error');
                        console.error('Error backend:', data);
                    }
                })
                .catch(err => {
                    showNotification('Error de conexión con el servidor', 'error');
                    console.error('Fetch error:', err);
                });
        }

        // Filter destinations by type
        function filterDestinationsByType(type) {
            const filtered = destinations.filter(dest => dest.type === type);
            updateDestinationsGrid(filtered);

            // Smooth scroll to destinations
            document.getElementById('destinations-grid').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }

        // Update destinations grid
        function updateDestinationsGrid(destinations) {
            const grid = document.getElementById('destinations-grid');

            // Animate out current cards
            anime({
                targets: '.destination-card',
                opacity: 0,
                translateY: -20,
                duration: 300,
                complete: () => {
                    grid.innerHTML = '';

                    // Add new cards
                    destinations.forEach((dest, index) => {
                        const card = document.createElement('div');
                        card.className = 'destination-card hover-lift cursor-pointer';
                        card.onclick = () => showDestinationDetails(dest);

                        card.innerHTML = `
                    <div class="relative overflow-hidden">
                        <img src="${dest.image}" alt="${dest.name}" class="w-full h-64 object-cover">
                        <div class="absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-1 rounded-full text-sm font-semibold">
                            ${dest.price}
                        </div>
                        <div class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                            ⭐ ${dest.rating}
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="font-display text-xl font-semibold">${dest.name}</h3>
                            <span class="text-sm text-gray-500">${dest.duration}</span>
                        </div>
                        <p class="text-gray-600 mb-3">${dest.location}</p>
                        <p class="text-sm text-gray-700 leading-relaxed">${dest.description}</p>
                        <button class="btn-primary w-full mt-4 py-2 rounded-lg font-semibold">
                            View Details
                        </button>
                    </div>
                `;

                        grid.appendChild(card);

                        // Animate in new cards
                        anime({
                            targets: card,
                            opacity: [0, 1],
                            translateY: [50, 0],
                            duration: 600,
                            delay: index * 100,
                            easing: 'easeOutExpo'
                        });
                    });
                }
            });
        }

        // Show destination details
        function showDestinationDetails(destination) {
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
            modal.onclick = (e) => {
                if (e.target === modal) closeModal(modal);
            };

            modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-4xl w-full max-h-screen overflow-y-auto">
            <div class="relative">
                <img src="${destination.image}" alt="${destination.name}" class="w-full h-64 object-cover rounded-t-2xl">
                <button onclick="closeModal(this.closest('.fixed'))" class="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100">
                    <span class="text-xl">✕</span>
                </button>
            </div>
            <div class="p-8">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="font-display text-3xl font-bold mb-2">${destination.name}</h2>
                        <p class="text-gray-600 text-lg">${destination.location}</p>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold text-primary mb-1">${destination.price}</div>
                        <div class="text-gray-600">per person</div>
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 class="font-semibold text-lg mb-4">Experience Highlights</h3>
                        <p class="text-gray-700 leading-relaxed mb-4">${destination.description}</p>
                        <div class="flex items-center space-x-4 text-sm text-gray-600">
                            <span>⭐ ${destination.rating} rating</span>
                            <span>•</span>
                            <span>${destination.duration} duration</span>
                        </div>
                    </div>
                    <div>
                        <h3 class="font-semibold text-lg mb-4">What's Included</h3>
                        <ul class="space-y-2 text-gray-700">
                            <li>✓ Premium accommodation</li>
                            <li>✓ Expert local guides</li>
                            <li>✓ All activities & entrance fees</li>
                            <li>✓ Airport transfers</li>
                            <li>✓ 24/7 support</li>
                        </ul>
                    </div>
                </div>
                
                <div class="flex gap-4">
                    <button onclick="handleBooking('${destination.id}')" class="btn-primary flex-1 py-3 rounded-lg font-semibold">
                        Book Now
                    </button>
                    <button onclick="addToWishlist('${destination.id}')" class="border-2 border-primary text-primary px-6 py-3 rounded-lg font-semibold hover:bg-primary hover:text-white transition-all">
                        ♡ Save
                    </button>
                </div>
            </div>
        </div>
    `;

            document.body.appendChild(modal);

            // Animate modal
            anime({
                targets: modal,
                opacity: [0, 1],
                duration: 300,
                easing: 'easeOutExpo'
            });

            anime({
                targets: modal.querySelector('.bg-white'),
                scale: [0.8, 1],
                opacity: [0, 1],
                duration: 400,
                delay: 100,
                easing: 'easeOutExpo'
            });
        }

        // Close modal
        function closeModal(modal) {
            anime({
                targets: modal,
                opacity: 0,
                duration: 200,
                complete: () => modal.remove()
            });
        }

        // Handle booking
        function handleBooking(destinationId) {
            showNotification('Redirigiendo a reserva segura...', 'info');

            setTimeout(() => {
                window.location.href = `bookings.html?destination=${destinationId}`;
            }, 1000);
        }

        // Add to wishlist
        function addToWishlist(destinationId) {
            showNotification('¡Agregado a tu lista de deseos!', 'success');

            // Store in localStorage
            let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
            if (!wishlist.includes(destinationId)) {
                wishlist.push(destinationId);
                localStorage.setItem('wishlist', JSON.stringify(wishlist));
            }
        }

        // Toggle chat widget
        function toggleChat() {
            const chatBubble = document.querySelector('.chat-bubble');

            // Simulate chat opening
            anime({
                targets: chatBubble,
                scale: [1, 1.2, 1],
                duration: 300,
                complete: () => {
                    showNotification('¡Soporte de chat próximamente!', 'info');
                }
            });
        }

        // Show notification
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `fixed top-24 right-6 z-50 px-6 py-4 rounded-lg shadow-lg text-white font-medium`;

            switch (type) {
                case 'success':
                    notification.classList.add('bg-green-500');
                    break;
                case 'error':
                    notification.classList.add('bg-red-500');
                    break;
                case 'info':
                default:
                    notification.classList.add('bg-blue-500');
                    break;
            }

            notification.textContent = message;
            document.body.appendChild(notification);

            // Animate in
            anime({
                targets: notification,
                translateX: [300, 0],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutExpo'
            });

            // Auto remove
            setTimeout(() => {
                anime({
                    targets: notification,
                    translateX: 300,
                    opacity: 0,
                    duration: 300,
                    complete: () => notification.remove()
                });
            }, 3000);
        }

        // Smooth scroll for navigation
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Handle window resize
        window.addEventListener('resize', function () {
            // Recalculate particle positions if needed
            if (window.p5 && window.p5.instance) {
                window.p5.instance.resizeCanvas(window.innerWidth, window.innerHeight);
            }
        });

        // Add scroll-based navigation opacity
        window.addEventListener('scroll', function () {
            const nav = document.querySelector('nav');
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;

            if (scrolled > 100) {
                nav.style.background = 'rgba(247, 243, 233, 0.95)';
            } else {
                nav.style.background = 'rgba(247, 243, 233, 0.9)';
            }
        });

        // Enhanced interaction functions
        function initializeEnhancedInteractions() {
            // Add magnetic cursor effect to buttons
            document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
                btn.addEventListener('mouseenter', function () {
                    anime({
                        targets: this,
                        scale: 1.05,
                        duration: 300,
                        easing: 'easeOutExpo'
                    });
                });

                btn.addEventListener('mouseleave', function () {
                    anime({
                        targets: this,
                        scale: 1,
                        duration: 300,
                        easing: 'easeOutExpo'
                    });
                });
            });

            // Add parallax effect to hero section
            window.addEventListener('scroll', function () {
                const scrolled = window.pageYOffset;
                const hero = document.querySelector('.hero-bg');
                if (hero) {
                    hero.style.transform = `translateY(${scrolled * 0.5}px)`;
                }
            });

            // Initialize character interactions
            initializeCharacterInteractions();

            // Add hover effects to destination cards
            document.querySelectorAll('.destination-card').forEach(card => {
                card.addEventListener('mouseenter', function () {
                    anime({
                        targets: this.querySelector('img'),
                        scale: 1.1,
                        duration: 600,
                        easing: 'easeOutExpo'
                    });
                });

                card.addEventListener('mouseleave', function () {
                    anime({
                        targets: this.querySelector('img'),
                        scale: 1,
                        duration: 600,
                        easing: 'easeOutExpo'
                    });
                });
            });

            // Add typing effect to hero text
            const heroTitle = document.querySelector('.hero-bg h1');
            if (heroTitle) {
                const text = heroTitle.innerHTML;
                heroTitle.innerHTML = '';

                let i = 0;
                const typeWriter = () => {
                    if (i < text.length) {
                        heroTitle.innerHTML += text.charAt(i);
                        i++;
                        setTimeout(typeWriter, 50);
                    }
                };

                setTimeout(typeWriter, 1000);
            }
        }

        // Initialize touch optimizations
        function initializeTouchOptimizations() {
            // Add touch feedback for mobile
            document.querySelectorAll('.btn-primary, .btn-secondary, .destination-card, .travel-type-card').forEach(element => {
                element.addEventListener('touchstart', function () {
                    anime({
                        targets: this,
                        scale: 0.95,
                        duration: 100,
                        easing: 'easeOutExpo'
                    });
                });

                element.addEventListener('touchend', function () {
                    anime({
                        targets: this,
                        scale: 1,
                        duration: 100,
                        easing: 'easeOutExpo'
                    });
                });
            });

            // Optimize scroll for mobile
            let ticking = false;
            window.addEventListener('scroll', function () {
                if (!ticking) {
                    requestAnimationFrame(function () {
                        // Smooth scroll behavior
                        ticking = false;
                    });
                    ticking = true;
                }
            });
        }

        // Initialize advanced animations
        function initializeAdvancedAnimations() {
            // Add floating animation to elements
            document.querySelectorAll('.animate-float').forEach((element, index) => {
                anime({
                    targets: element,
                    translateY: [-10, 10],
                    duration: 3000 + (index * 500),
                    easing: 'easeInOutSine',
                    direction: 'alternate',
                    loop: true
                });
            });

            // Add glow effect to interactive elements
            document.querySelectorAll('.chat-bubble, .btn-primary').forEach(element => {
                setInterval(() => {
                    anime({
                        targets: element,
                        boxShadow: [
                            '0 10px 25px rgba(224, 122, 95, 0.3)',
                            '0 15px 35px rgba(224, 122, 95, 0.5)',
                            '0 10px 25px rgba(224, 122, 95, 0.3)'
                        ],
                        duration: 2000,
                        easing: 'easeInOutSine'
                    });
                }, 3000);
            });

            // Add color cycling to gradient text
            document.querySelectorAll('.gradient-text').forEach(element => {
                let hue = 0;
                setInterval(() => {
                    hue = (hue + 1) % 360;
                    element.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 60) % 360}, 70%, 60%))`;
                    element.style.webkitBackgroundClip = 'text';
                    element.style.webkitTextFillColor = 'transparent';
                }, 100);
            });
        }

        // Enhanced destination search with real-time filtering
        function initializeAdvancedDestinationSearch() {
            const searchInput = document.getElementById('destination');
            const suggestions = document.getElementById('destination-suggestions');

            if (searchInput && suggestions) {
                let searchTimeout;

                searchInput.addEventListener('input', function () {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        const query = this.value.toLowerCase();
                        if (query.length >= 2) {
                            const filteredDestinations = destinations.filter(dest =>
                                dest.name.toLowerCase().includes(query) ||
                                dest.location.toLowerCase().includes(query) ||
                                dest.description.toLowerCase().includes(query)
                            );

                            if (filteredDestinations.length > 0) {
                                suggestions.innerHTML = filteredDestinations.slice(0, 5).map(dest =>
                                    `<div class="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0" onclick="selectDestination('${dest.name}')">
                                <div class="font-medium">${dest.name}</div>
                                <div class="text-sm text-gray-600">${dest.location} • ${dest.priceDisplay}</div>
                            </div>`
                                ).join('');
                                suggestions.classList.remove('hidden');
                            } else {
                                suggestions.classList.add('hidden');
                            }
                        } else {
                            suggestions.classList.add('hidden');
                        }
                    }, 300);
                });

                // Hide suggestions when clicking outside
                document.addEventListener('click', function (e) {
                    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
                        suggestions.classList.add('hidden');
                    }
                });
            }
        }

        // Initialize enhanced chart interactions
        function initializeInteractiveCharts() {
            // Create travel patterns chart if ECharts is available
            if (typeof echarts !== 'undefined') {
                const chartContainer = document.getElementById('travel-patterns-chart');
                if (chartContainer) {
                    const chart = echarts.init(chartContainer);

                    const option = {
                        title: {
                            text: 'Travel Patterns',
                            left: 'center'
                        },
                        tooltip: {
                            trigger: 'axis'
                        },
                        xAxis: {
                            type: 'category',
                            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
                        },
                        yAxis: {
                            type: 'value'
                        },
                        series: [
                            {
                                name: 'Bookings',
                                type: 'line',
                                data: [12, 19, 3, 5, 2, 8],
                                smooth: true,
                                lineStyle: {
                                    color: '#0D4F4C'
                                },
                                areaStyle: {
                                    color: 'rgba(13, 79, 76, 0.1)'
                                }
                            }
                        ]
                    };

                    chart.setOption(option);

                    // Add interactive hover effects
                    chart.on('mouseover', function (params) {
                        anime({
                            targets: chartContainer,
                            scale: 1.02,
                            duration: 300,
                            easing: 'easeOutExpo'
                        });
                    });

                    chart.on('mouseout', function (params) {
                        anime({
                            targets: chartContainer,
                            scale: 1,
                            duration: 300,
                            easing: 'easeOutExpo'
                        });
                    });
                }
            }
        }

        // Initialize character interactions
        function initializeCharacterInteractions() {
            const characters = document.querySelectorAll('.avatar-explorador, .avatar-aventurero, .avatar-sabio, .avatar-valiente');

            characters.forEach((character, index) => {
                // Add click interaction for characters
                character.addEventListener('click', function () {
                    triggerCharacterInteraction(character, index);
                });

                // Add hover effects
                character.addEventListener('mouseenter', function () {
                    anime({
                        targets: character,
                        scale: 1.1,
                        rotate: 5,
                        duration: 300,
                        easing: 'easeOutExpo'
                    });
                });

                character.addEventListener('mouseleave', function () {
                    anime({
                        targets: character,
                        scale: 1,
                        rotate: 0,
                        duration: 300,
                        easing: 'easeOutExpo'
                    });
                });
            });
        }

        // Trigger character interaction
        function triggerCharacterInteraction(character, index) {
            const characterTypes = ['Explorador', 'Aventurera', 'Sabio', 'Valiente'];
            const characterType = characterTypes[index];

            // Show character message
            showCharacterMessage(characterType, character);

            // Animate character
            anime({
                targets: character,
                scale: [1, 1.3, 1],
                rotate: [0, 15, -10, 0],
                duration: 800,
                easing: 'easeInOutElastic(1, .8)'
            });
        }

        // Show character message
        function showCharacterMessage(characterType, characterElement) {
            const messages = {
                'Explorador': '¡Hola, soy el Explorador! ¿Listo para descubrir nuevos mundos?',
                'Aventurera': '¡La aventura te espera! ¿Te atreves a seguirme?',
                'Sabio': 'El conocimiento es el verdadero tesoro de toda odisea.',
                'Valiente': '¡El coraje nos llevará a la victoria! ¡Vamos!'
            };

            // Create message bubble
            const messageBubble = document.createElement('div');
            messageBubble.className = 'character-message-bubble fixed z-50';
            messageBubble.innerHTML = `
        <div class="bg-white rounded-lg p-4 shadow-lg max-w-xs text-sm text-gray-800 border-2 border-orange-200">
            <p>${messages[characterType]}</p>
            <div class="absolute -bottom-2 left-4 w-4 h-4 bg-white border-b-2 border-r-2 border-orange-200 transform rotate-45"></div>
        </div>
    `;

            // Position the bubble
            const rect = characterElement.getBoundingClientRect();
            messageBubble.style.top = (rect.top - 80) + 'px';
            messageBubble.style.left = rect.left + 'px';

            document.body.appendChild(messageBubble);

            // Animate in
            anime({
                targets: messageBubble,
                opacity: [0, 1],
                translateY: [-20, 0],
                duration: 300,
                easing: 'easeOutQuart'
            });

            // Remove after 3 seconds
            setTimeout(() => {
                anime({
                    targets: messageBubble,
                    opacity: [1, 0],
                    translateY: [0, -20],
                    duration: 300,
                    easing: 'easeInQuart',
                    complete: () => {
                        if (document.body.contains(messageBubble)) {
                            document.body.removeChild(messageBubble);
                        }
                    }
                });
            }, 3000);
        }

        // Game function
        function startGame() {
            console.log('🎮 Iniciando Juego Odisea Challenge');

            // Create game modal
            const gameModal = document.createElement('div');
            gameModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            gameModal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 relative">
            <button class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl" onclick="closeGameModal()">×</button>
            
            <div class="text-center mb-8">
                <h2 class="font-display text-3xl font-bold gradient-text mb-4">🎮 Juego Odisea Challenge</h2>
                <p class="text-gray-600 mb-6">
                    Demuestra tu valor y coraje resolviendo retos para ganar premios y viajes gratuitos.
                </p>
            </div>
            
            <div class="game-content">
                <div class="mb-6">
                    <h3 class="font-semibold text-lg mb-4">¡Bienvenido, Explorador!</h3>
                    <p class="text-gray-600 mb-6">
                        Estás a punto de comenzar una aventura épica. Responde correctamente las preguntas 
                        sobre cultura mexicana, historia y curiosidades para ganar puntos y premios.
                    </p>
                </div>
                
                <div class="grid md:grid-cols-2 gap-4 mb-8">
                    <div class="bg-blue-50 p-4 rounded-lg text-center">
                        <div class="text-2xl mb-2">🏆</div>
                        <h4 class="font-semibold">Premios</h4>
                        <p class="text-sm text-gray-600">Viajes gratuitos, descuentos especiales</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg text-center">
                        <div class="text-2xl mb-2">⭐</div>
                        <h4 class="font-semibold">Puntos</h4>
                        <p class="text-sm text-gray-600">Acumula puntos para canjear recompensas</p>
                    </div>
                </div>
                
                <div class="text-center">
                    <button class="btn-primary px-8 py-3 rounded-lg font-bold text-lg" onclick="startGameChallenge()">
                        Comenzar Reto
                    </button>
                </div>
            </div>
        </div>
    `;

            document.body.appendChild(gameModal);

            // Animate in
            anime({
                targets: gameModal,
                opacity: [0, 1],
                duration: 300,
                easing: 'easeOutExpo'
            });

            anime({
                targets: gameModal.querySelector('.bg-white'),
                scale: [0.8, 1],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutExpo',
                delay: 100
            });
        }

        // Close game modal
        function closeGameModal() {
            const gameModal = document.querySelector('.fixed.inset-0.bg-black');
            if (gameModal) {
                anime({
                    targets: gameModal,
                    opacity: 0,
                    duration: 300,
                    complete: () => gameModal.remove()
                });
            }
        }

        // Start game challenge
        function startGameChallenge() {
            showNotification('¡El desafío de Odisea Challenge comenzará pronto! Prepárate para demostrar tu valor.', 'success');
            closeGameModal();
        }

        // Export functions for global access
        window.closeModal = closeModal;
        window.handleBooking = handleBooking;
        window.addToWishlist = addToWishlist;
        window.toggleChat = toggleChat;
        window.selectDestination = selectDestination;
        window.startGame = startGame;
        window.closeGameModal = closeGameModal;
        window.startGameChallenge = startGameChallenge;

        // --- Manejo del Formulario de Reserva Final ---
        // --- Manejo del Formulario de Reserva Final ---
        document.addEventListener('DOMContentLoaded', function () {
            const finalForm = document.getElementById('final-booking-form');
            if (finalForm) {

                // Elementos del formulario
                const experienceSelect = document.getElementById('experience-select'); // Ahora es Punto de Salida
                const dateInput = document.getElementById('travel-date');
                const travelersSelect = document.getElementById('travelers-count');
                const travelersDetailsContainer = document.getElementById('travelers-details');
                const summaryExperience = document.getElementById('summary-experience-select');
                const summaryDate = document.getElementById('summary-travel-date');
                const summaryTravelers = document.getElementById('summary-travelers-count');
                const totalPriceEl = document.getElementById('total-price');

                const BASE_PRICE = 1500;

                // Función para generar campos de viajeros
                function renderTravelerFields() {
                    const count = parseInt(travelersSelect.value) || 0;
                    travelersDetailsContainer.innerHTML = ''; // Limpiar

                    if (count > 0) {
                        const title = document.createElement('h4');
                        title.className = "font-semibold text-gray-700 mb-2";
                        title.textContent = "Datos de los Viajeros";
                        travelersDetailsContainer.appendChild(title);
                    }

                    for (let i = 1; i <= count; i++) {
                        const row = document.createElement('div');
                        row.className = "grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg";

                        row.innerHTML = `
                            <div>
                                <label class="block text-xs font-medium text-gray-500 mb-1">Nombre Completo (Viajero ${i})</label>
                                <input type="text" name="traveler_name_${i}" required
                                    class="form-input w-full px-3 py-2 rounded border border-gray-300 focus:border-primary focus:outline-none text-sm"
                                    placeholder="Nombre del viajero ${i}">
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-500 mb-1">Edad (Viajero ${i})</label>
                                <input type="number" name="traveler_age_${i}" required min="0" max="120"
                                    class="form-input w-full px-3 py-2 rounded border border-gray-300 focus:border-primary focus:outline-none text-sm"
                                    placeholder="Edad">
                            </div>
                        `;
                        travelersDetailsContainer.appendChild(row);
                    }
                }

                // Función para actualizar el resumen en tiempo real
                function updateSummary() {
                    // Actualizar Fecha
                    summaryDate.textContent = dateInput.value || '-';

                    // Actualizar Viajeros
                    const travelers = parseInt(travelersSelect.value) || 0;
                    summaryTravelers.textContent = travelers > 0 ? `${travelers} persona${travelers > 1 ? 's' : ''}` : '-';

                    // Actualizar Punto de Salida (antes Experiencia)
                    if (experienceSelect.value) {
                        const selectedOption = experienceSelect.options[experienceSelect.selectedIndex];
                        // Extraemos solo el nombre de la ciudad del texto (ej: "Dolores Hidalgo - $2800" -> "Dolores Hidalgo")
                        const cityName = selectedOption.text.split('-')[0].trim();
                        summaryExperience.textContent = cityName;
                    } else {
                        summaryExperience.textContent = '-';
                    }

                    // Calcular Precio Total
                    if (travelers > 0) {
                        const total = travelers * BASE_PRICE;
                        totalPriceEl.textContent = `$${total.toLocaleString('es-MX')}`;
                    } else {
                        totalPriceEl.textContent = '$0';
                    }
                }

                // Listeners para actualización en tiempo real
                experienceSelect.addEventListener('change', updateSummary);
                dateInput.addEventListener('change', updateSummary);
                travelersSelect.addEventListener('change', function () {
                    updateSummary();
                    renderTravelerFields();
                });

                // Inicializar campos de viajeros
                renderTravelerFields();

                // Submit Handler
                finalForm.addEventListener('submit', function (e) {
                    e.preventDefault();

                    const experience = experienceSelect.value;
                    const date = dateInput.value;
                    const travelers = parseInt(travelersSelect.value);
                    const additionalInfo = document.getElementById('additional-info').value;

                    // Recolectar datos de viajeros
                    const travelersData = [];
                    for (let i = 1; i <= travelers; i++) {
                        const name = document.querySelector(`input[name="traveler_name_${i}"]`).value;
                        const age = document.querySelector(`input[name="traveler_age_${i}"]`).value;
                        travelersData.push({ name, age });
                    }

                    if (!experience || !date) {
                        showNotification('Por favor completa todos los campos requeridos', 'error');
                        return;
                    }

                    // Notificación visual de proceso
                    showNotification('Procesando reserva...', 'info');

                    // Construir payload
                    const payload = {
                        city: experienceSelect.options[experienceSelect.selectedIndex].text.split('-')[0].trim(), // Enviar nombre de ciudad limpio
                        departure_at: new Date(date).toISOString(),
                        capacity: 40,
                        price: travelers * BASE_PRICE,
                        metadata: {
                            travelers_count: travelers,
                            travelers_details: travelersData,
                            notes: additionalInfo
                        }
                    };

                    // Enviar al backend
                    fetch('http://localhost:3000/api/v1/viajes', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.ok) {
                                showNotification('¡Reserva creada exitosamente!', 'success');
                                console.log('Viaje creado:', data.trip);

                                // Resetear formulario y resumen
                                finalForm.reset();
                                updateSummary(); // Vuelve los valores a '-' y '$0' porque el form se limpió
                            } else {
                                console.error('Error backend:', data);
                                showNotification('Error al crear reserva: ' + (data.error || 'Desconocido'), 'error');
                            }
                        })
                        .catch(err => {
                            console.error('Fetch error:', err);
                            showNotification('Error de conexión con el servidor local', 'error');
                        });
                });
            }
        });
