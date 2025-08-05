function sendCode() {
            var email = document.querySelector('input[name="email"]').value;
            
            // Check if email field is empty
            if (!email) {
                document.getElementById("status").innerText = "请输入邮箱";
                return;
            }
            
            // Disable the button and start countdown
            var codeButton = document.getElementById("code_button");
            codeButton.disabled = true;
            var countdown = 60;
            codeButton.innerText = countdown + "s";
            
            // Start countdown timer
            var timer = setInterval(function() {
                countdown--;
                codeButton.innerText = countdown + "s";
                if (countdown <= 0) {
                    clearInterval(timer);
                    codeButton.innerText = "获取验证码";
                    codeButton.disabled = false;
                }
            }, 1000);
            
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
                document.getElementById("status").innerText = "发送验证码失败，请稍后再试";
            });
        }