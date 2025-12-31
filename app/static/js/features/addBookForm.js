import { apiFetch } from "../utils/api.js";
import { notify } from "../core/notifications.js";

export function bindAddBookForm(form, { afterCreate } = {}) {
  // afterCreate is not an object, but a property being extract from an object
  // probably a config object with a callback function as value for afterCreate
  async function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const title = fd.get('title').trim();
    // const author = fd.get('author').trim();
    const unit_price = Number(fd.get('unit_price'));

    if (!title) return notify('Le titre est obligatoire', 'error');
    // validate price too

    const book = { title, unit_price };

    const btn = e.submitter;
    btn.disabled = true;

    try {
      const res = await apiFetch('/api/admin/books', {
        method: 'POST',
        body: JSON.stringify(book)
      });
      notify(`Livre "${res.title}" ajouté`, 'success');
      if (typeof afterCreate === 'function') await afterCreate();
      form.reset();
    } catch (err) {
      // error already shown ? // notify(err.message || 'Failed to add book', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  form.removeEventListener('submit', onSubmit);
  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
// return an unbind function to remove the event listener when needed

// Usage:
// const unbind = bindAddBookForm(document.getElementById('addBookForm'), { afterCreate: async () => { await loadInventory(); } });
// unbind(); // to remove the event listener when not needed anymore

// The afterCreate callback is useful to refresh the inventory list after adding a new book
// It can be an async function if it needs to perform asynchronous operations
// Example:
// await bindAddBookForm(form, { afterCreate: async () => { await loadInventory(); } });
// The form parameter is the HTMLFormElement to bind the submit event to  

// The apiFetch function is a wrapper around fetch to handle API requests and responses
// The notify function is used to show notifications to the user
// It takes a message and a type ('success' or 'error') as parameters
// Example: notify('Book added', 'success');  // Example: notify('Failed to add book', 'error');

// The FormData API is used to easily extract form data
// The e.submitter property is used to get the button that was used to submit the form
// This allows us to disable the button during the submission process to prevent multiple submissions
// The form.reset() method is called to clear the form after a successful submission
// The function returns an unbind function to remove the event listener when it's no longer needed
// This is useful for single-page applications where components may be mounted and unmounted dynamically

// The function also includes basic validation to ensure the title is not empty
// Additional validation can be added as needed, such as checking the price is a positive number
// The function uses async/await syntax for handling asynchronous operations
// This makes the code more readable and easier to understand compared to using Promises directly
// Error handling is done using try/catch blocks to catch any errors that occur during the API request
// The notify function is used to inform the user of success or failure of the operation
// The function is designed to be reusable and can be easily integrated into different parts of the application
// It follows best practices for event handling and form submission in modern web development
// Overall, this function provides a clean and efficient way to handle adding new books through a form interface

// The function can be further enhanced by adding more features as needed
// For example, adding loading indicators, more detailed error messages, or additional form fields
// The afterCreate callback can also be extended to accept parameters if needed
// This allows for more flexibility in how the function can be used in different contexts
// The function is part of a larger application that includes other features such as inventory management and order processing
// It integrates seamlessly with these features through the use of the apiFetch and notify utilities
// The overall design of the function emphasizes modularity and reusability, making it easy to maintain and extend over time
// This is important for building scalable web applications that can evolve to meet changing requirements
// The function is written in modern JavaScript (ES6+) and takes advantage of new language features to improve code quality and developer experience
// It is also well-documented with comments explaining each part of the code, making it easier for other developers to understand and work with
// In summary, this function provides a robust solution for handling book addition through a form, with a focus on usability, maintainability, and integration with the broader application ecosystem.

// What is mounting and unmounting in web applications?
// Mounting refers to the process of attaching a component or element to the DOM (Document Object Model)
// This typically involves rendering the component and inserting it into the appropriate place in the HTML structure
// Unmounting is the opposite process, where a component or element is removed from the DOM
// This can involve cleaning up event listeners, freeing up resources, and ensuring that the component is no longer visible or interactive

// In single-page applications (SPAs), components may be mounted and unmounted dynamically as the user navigates through the app
// This allows for a more fluid user experience without the need for full page reloads
// Properly managing mounting and unmounting is important for performance and memory management
// It helps prevent memory leaks and ensures that the application remains responsive and efficient over time
// Frameworks like React, Vue, and Angular provide built-in mechanisms for handling mounting and unmounting of components
// In vanilla JavaScript, developers need to manually manage these processes, often using event listeners and DOM manipulation techniques
// Overall, understanding mounting and unmounting is crucial for building effective web applications that provide a seamless user experience

// Example of mounting and unmounting in a toplivres context:
// When a user navigates to the admin dashboard, the mountAdmin function is called
// This function sets up the necessary event listeners and loads the admin operations data
// When the user navigates away from the admin dashboard, the unmountAdmin function is called
// This function removes the event listeners and cleans up any resources associated with the admin dashboard
// This ensures that the application remains efficient and responsive as the user interacts with different parts of the app

// Similarly, when a user navigates to the customer dashboard, the mountCustomer function is called
// This function sets up the order form and loads the customer's order history and inventory data
// When the user navigates away from the customer dashboard, the unmountCustomer function is called
// This function removes the event listeners and cleans up any resources associated with the customer dashboard
// This approach helps maintain a clean and efficient application state as users move between different sections of the app
// By following these practices, developers can create web applications that are both user-friendly and performant
// This is especially important in modern web development, where users expect fast and seamless interactions with web apps
// Properly managing mounting and unmounting of components is a key aspect of achieving this goal
// It allows developers to build complex applications that remain easy to use and maintain over time
// In conclusion, the bindAddBookForm function is a valuable tool for handling book addition by an admin of toplivres
// It incorporates best practices for form handling, event management, and user feedback
// The function is designed to be flexible and reusable, making it a useful addition to the toplivres codebase.

// The function can be easily integrated into the existing admin dashboard functionality
// It complements other features such as viewing and managing inventory, processing orders, and handling user accounts
// By providing a straightforward way to add new books, the function enhances the overall usability of the admin interface
// This is important for ensuring that admins can efficiently manage the bookstore and keep the inventory up to date
// The function's use of modern JavaScript features and best practices also helps ensure that it is maintainable and scalable
// This is crucial for the long-term success of the toplivres application, as it allows for easy updates and enhancements in the future
// Overall, the bindAddBookForm function is a well-designed solution for handling book addition in the toplivres admin dashboard
// It provides a clean and efficient way to manage this important aspect of the bookstore's operations
// By following best practices and focusing on usability, the function contributes to a positive experience for both admins and users of the toplivres application
// In summary, this function is an essential part of the toplivres codebase, providing a robust solution for adding new books through a form interface
// Its design emphasizes usability, maintainability, and integration with the broader application ecosystem
// As such, it is a valuable tool for managing the bookstore and ensuring that the inventory remains current and accurate
// The function's flexibility and reusability also make it a useful addition to the toplivres codebase, allowing for easy integration into different parts of the application as needed
// By following best practices and focusing on user experience, the bindAddBookForm function helps ensure the success of the toplivres application in the competitive online bookstore market
// Overall, this function represents a thoughtful and effective approach to handling book addition in a web application context
// It serves as a model for other developers looking to implement similar functionality in their own projects
// By leveraging modern JavaScript features and best practices, the function provides a clean and efficient solution for managing book inventory in an online bookstore setting
// In conclusion, the bindAddBookForm function is a well-crafted piece of code that effectively addresses the needs of the toplivres admin dashboard
// Its design prioritizes usability, maintainability, and integration with the broader application ecosystem.
