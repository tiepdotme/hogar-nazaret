document.addEventListener('DOMContentLoaded', () => {
  var formContainer = document.getElementById('hosted-fields');
  if (formContainer) {
    var stripeKey = formContainer.dataset.key;
    var lang = formContainer.dataset.lang;
    var description = formContainer.dataset.description;
    var env = formContainer.dataset.env;

    var stripe = Stripe(stripeKey, { locale: lang });
    var elements = stripe.elements();
    var elementStyles = {
      base: {
        color: '#4a4a4a',  // Dark Grey color
        fontWeight: 600,
        fontFamily: 'Quicksand, Open Sans, Segoe UI, sans-serif',
        fontSize: '16px',
        fontSmoothing: 'antialiased',

        '::placeholder': {
          color: '#bbb2d7', // Primary Light color
        },

        ':focus::placeholder': {
          color: '#bbb2d7', // Primary Light color
        },
      },
      invalid: {
        color: '#4a4a4a',  // Dark Grey color
      },
    };

    var elementClasses = {
      focus: 'focus',
      empty: 'empty',
      invalid: 'invalid',
    };

    var cardNumber = elements.create('cardNumber', {
      style: elementStyles,
      classes: elementClasses,
    });
    cardNumber.mount('#hosted-fields-card-number');

    var cardExpiry = elements.create('cardExpiry', {
      style: elementStyles,
      classes: elementClasses,
    });
    cardExpiry.mount('#hosted-fields-card-expiry');

    var cardCvc = elements.create('cardCvc', {
      style: elementStyles,
      classes: elementClasses,
    });
    cardCvc.mount('#hosted-fields-card-cvc');

    function registerElements(elements, formContainerId) {
      var formContainer = document.getElementById(formContainerId);

      var form = formContainer.querySelector('form');
      var error = formContainer.querySelector('.error');
      var errorMessage = error.querySelector('.notification');

      function enableInputs() {
        Array.prototype.forEach.call(
          form.querySelectorAll(
            "input[type='text'], input[type='email'], input[type='tel']"
          ),
          function(input) {
            input.removeAttribute('disabled');
          }
        );
      }

      function disableInputs() {
        Array.prototype.forEach.call(
          form.querySelectorAll(
            "input[type='text'], input[type='email'], input[type='tel']"
          ),
          function(input) {
            input.setAttribute('disabled', 'true');
          }
        );
      }

      function triggerBrowserValidation() {
        // The only way to trigger HTML5 form validation UI is to fake a user submit
        // event.
        var submit = document.createElement('input');
        submit.type = 'submit';
        submit.style.display = 'none';
        form.appendChild(submit);
        submit.click();
        submit.remove();
      }

      // Listen for errors from each Element, and show error messages in the UI.
      var savedErrors = {};
      elements.forEach(function(element, idx) {
        element.on('change', function(event) {
          if (event.error) {
            error.classList.remove('is-hidden');
            savedErrors[idx] = event.error.message;
            errorMessage.innerText = event.error.message;
          } else {
            savedErrors[idx] = null;

            // Loop over the saved errors and find the first one, if any.
            var nextError = Object.keys(savedErrors)
              .sort()
              .reduce(function(maybeFoundError, key) {
                return maybeFoundError || savedErrors[key];
              }, null);

            if (nextError) {
              // Now that they've fixed the current error, show another one.
              errorMessage.innerText = nextError;
            } else {
              // The user fixed the last error; no more errors.
              error.classList.add('is-hidden');
            }
          }
        });
      });

      // Listen on the form's 'submit' handler...
      form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Trigger HTML5 validation UI on the form if any of the inputs fail
        // validation.
        var plainInputsValid = true;
        Array.prototype.forEach.call(form.querySelectorAll('input'), function(
          input
        ) {
          if (input.checkValidity && !input.checkValidity()) {
            plainInputsValid = false;
            return;
          }
        });
        if (!plainInputsValid) {
          triggerBrowserValidation();
          return;
        }

        // Show a loading screen...
        const loadingContainer = document.getElementById('hosted-fields-loading-container');
        loadingContainer.classList.remove('is-hidden');
        formContainer.classList.add('submitting');
        formContainer.classList.add('is-hidden');

        // Disable all inputs.
        disableInputs();

        // Use Stripe.js to create a token. We only need to pass in one Element
        // from the Element group in order to create a token. We can also pass
        // in the additional customer data we collected in our form.
        stripe.createToken(elements[0]).then(function(result) {
          if (result.token) {
            // Send the token to our server to charge it :)
            var finalAmountinDollars = document.querySelector('input[name="give_a_hug_donation_amount"]:checked').value;
            var finalAmount = parseInt(finalAmountinDollars) * 100;
            var requestBody = {
              amount: finalAmount,
              stripe_token: result.token.id,
              email: '',  // Only present when using Apple Pay/Google Pay
              description: description,
              lang: lang,
              env: env
            };
            const failureHandler = function() {
              // Report to the browser that the payment failed, prompting it to
              // re-show the payment interface
              loadingContainer.classList.add('is-hidden');
              formContainer.classList.remove('submitting');
              formContainer.classList.remove('is-hidden');
            };

            fetch('https://boiling-earth-96925.herokuapp.com/payments', {
              method: 'POST',
              body: JSON.stringify(requestBody),
              headers: {'content-type': 'application/json'},
            })
            .then(function(response) {
              if (response.ok) {
                // Report to the browser that the payment was successful, prompting
                // it to close the browser payment interface.
                loadingContainer.classList.add('is-hidden');
              } else {
                failureHandler();
              }
            })
            .catch(function() {
              failureHandler();
            });
          } else {
            failureHandler();
            // In case of an error, un-disable inputs
            enableInputs();
          }
        });
      });
    }

    registerElements([cardNumber, cardExpiry, cardCvc], 'hosted-fields');
  }
});
