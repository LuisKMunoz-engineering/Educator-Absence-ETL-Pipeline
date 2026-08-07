# **App Name**: AppAusentismo

## Core Features:

- Login Authentication: Secure user authentication using a master password. Note: currently only simple authentication is supported.
- Report Form: Dynamic form for submitting monthly ZDA reports, including fields for the reporting person's name, position, municipality, and month.
- Report Upload: Drag-and-drop interface for uploading .xlsx or .xlsm report files, with validation and file preview.
- Dynamic Report Items: Functionality to add multiple report items to the form, allowing for the submission of several reports at once.
- Data URI Conversion: Conversion of uploaded files to data URIs for transmission to the cloud function.
- Success Summary: Display a detailed summary of successfully uploaded reports, including user information and report details, after the submission.
- Redaction Assistant: An AI-powered tool that scans the uploaded excel file. If sensitive personal information like document IDs or social security numbers are detected, the tool can assist with redacting such information to safeguard privacy before the report is finalized. If no sensitive personal information is found, the user will be informed so they can proceed confidently.

## Style Guidelines:

- Primary color: Saturated cerulean (#007BA7) to reflect institutional authority and trustworthiness.
- Background color: Very light grayish-blue (#F0F8FF) for a clean, unobtrusive backdrop.
- Accent color: Contrasting teal (#008080) to highlight key interactive elements, such as the primary action buttons.
- Body and headline font: 'Inter' (sans-serif) for a modern, neutral, and readable interface. Its clean lines and good legibility ensure clarity across all screen sizes.
- Use simple, clear icons from a consistent set (like Feather or Phosphor) to visually represent actions and data types.
- Maintain a clean and organized layout using a grid system, ensuring responsiveness across different devices.
- Incorporate subtle transitions and animations to enhance user experience without distracting from the main tasks. Use animations to confirm interactions and guide the user through the reporting process.