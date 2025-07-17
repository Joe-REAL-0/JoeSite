function sendCode() {
            var email = document.querySelector('input[name="email"]').value;
            fetch('/email_sender', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: email })
            })
            .then(response => response.json())
            .then(data => {
                // Handle the response from the server
                document.getElementById("status").innerText = data.message;
            })
            .catch(error => {
                // Handle any errors
                console.error(error);
            });
        }