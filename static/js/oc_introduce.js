document.addEventListener('DOMContentLoaded', function() {
    // Check if device is mobile
    const isMobile = window.innerWidth <= 768;
    
    // If mobile device, add mobile class to body
    if (isMobile) {
        document.body.classList.add('mobile-device');
    }
    
    // Setup sidebar toggle button for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('expanded');
            // Change button text based on sidebar state
            this.textContent = sidebar.classList.contains('expanded') ? '✕' : '☰';
        });
    }
    
    // If there are titles, show the first one by default
    const titleItems = document.querySelectorAll('.TextTitle');
    if (titleItems.length > 0) {
        titleItems[0].classList.add('active');
        const firstTitle = titleItems[0].getAttribute('data-title');
        showInfo(firstTitle);
    }
    
    // Add click event listeners to all titles
    titleItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all titles
            titleItems.forEach(el => el.classList.remove('active'));
            
            // Add active class to the clicked title
            this.classList.add('active');
            
            // Get the title and show its info
            const title = this.getAttribute('data-title');
            showInfo(title);
            
            // On mobile, collapse sidebar after selection
            if (isMobile && sidebar.classList.contains('expanded')) {
                sidebar.classList.remove('expanded');
                sidebarToggle.textContent = '☰';
            }
        });
    });
    
    // Add animation when scrolling
    const output = document.getElementById('output');
    if (output) {
        output.addEventListener('scroll', function() {
            const scrollPosition = this.scrollTop;
            const paragraphs = this.querySelectorAll('p');
            
            paragraphs.forEach((paragraph, index) => {
                const position = paragraph.offsetTop;
                const windowHeight = window.innerHeight;
                
                if (scrollPosition > position - windowHeight * 0.8) {
                    setTimeout(() => {
                        paragraph.style.opacity = '1';
                        paragraph.style.transform = 'translateY(0)';
                    }, index * 100);
                }
            });
        });
    }
});

function showInfo(item) {
    fetch('/find_text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ textType: 'oc_introduce', title: item })
    })
    .then(response => response.json())
    .then(data => {
        const outputElement = document.getElementById('output');
        
        // Convert newlines to paragraphs for better display
        const formattedText = data.text.split('\n\n')
            .filter(paragraph => paragraph.trim() !== '')
            .map(paragraph => `<p class="content-paragraph">${paragraph.replace(/\n/g, '<br>')}</p>`)
            .join('');
            
        outputElement.innerHTML = formattedText;
        
        // Apply fade-in effect to each paragraph
        const paragraphs = outputElement.querySelectorAll('.content-paragraph');
        paragraphs.forEach((paragraph, index) => {
            paragraph.style.opacity = '0';
            paragraph.style.transform = 'translateY(20px)';
            paragraph.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                paragraph.style.opacity = '1';
                paragraph.style.transform = 'translateY(0)';
            }, index * 200);
        });
    })
    .catch(error => {
        console.error('Error:', error);
    });
}
