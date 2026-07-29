# Customers Management - Google Stitch Prompt

## Project Goal
Create the Customers Management interface for storing customer data, segmentation, communication, and order history tracking. This provides CRM functionality within the tenant workspace.

## Design Style
- **Customer-Centric Interface** - Focus on customer relationships and data
- **CRM-Style Design** - Professional customer relationship management tools
- **Multi-Tenant Support** - Tenant-specific customer management
- **Arabic RTL Support** - Full RTL interface with Saudi/Egyptian market features
- **Role-Based Access** - Interface customized based on user role within tenant
- **Responsive Design** - Comprehensive desktop interface with mobile supplemental access
- **Performance-Oriented** - Fast access to customer data and communication tools

## Layout Structure

### Header & Context
- **Customers Management Title**:
  - "إدارة العملاء" (Customers Management)
  - Current customer count and activity metrics
  - Quick access to import/export and communication functions
  - Search bar for customer lookup

- **Action Bar**:
  - "إضافة عميل جديد" (Add New Customer) - Primary button
  - "استيراد العملاء" (Import Customers) - CSV/bulk import
  - "تصدير العملاء" (Export Customers) - Export current list
  - "إرسال رسالة جماعية" (Send Bulk Message) - Communication tool

### Main Content Area

#### Customer Directory Table
- **Columns**: Customer Name, Phone, Email, Total Orders, Total Spent, Last Order, Tags, Status, Created Date, Actions
- **Search and Filter**:
  - Search by name, phone, email
  - Filter by total spent range
  - Filter by order count
  - Filter by tags
  - Filter by registration date
  - Filter by last order date
  - Filter by governorate/city
- **Sorting**: Sort by name, total spent, order count, last order date
- **Bulk Actions**:
  - Send message
  - Add tags
  - Export selected
  - Delete customers
- **Customer Status**: Active/Inactive badges
- **Pagination**: 10/25/50/100 per page

#### Customer Profile
- **Customer Information**:
  - Full name
  - Phone number
  - Email address
  - Address (governorate, city, detailed address)
  - Registration date
  - Last activity date
  - Customer tags
  - Notes

- **Order History**:
  - List of all orders
  - Order number, date, total, status
  - Quick view of order items
  - Links to order details

- **Communication History**:
  - Sent messages
  - Received responses
  - Call logs
  - Notes

- **Customer Metrics**:
  - Total orders
  - Total spent
  - Average order value
  - Last order date
  - Preferred products

- **Actions**:
  - Edit customer details
  - Send message
  - Add note
  - Add tag
  - Export customer data
  - Delete customer

#### Customer Creation/Edit
- **Basic Information**:
  - Full name
  - Phone number
  - Email address
  - Address (governorate, city, detailed address)

- **Tags and Segmentation**:
  - Add/remove tags
  - Customer segment
  - VIP status

- **Notes**:
  - Customer notes
  - Internal comments

#### Customer Segmentation
- **Segment List**:
  - Segment name, description, customer count
  - Auto/manual segments
  - Segment rules

- **Segment Details**:
  - Segment name and description
  - Customer count
  - Segment rules (filters)
  - Customers in segment

#### Communication Center
- **Message Templates**:
  - Template name, subject, content
  - Variables (customer name, order details)
  - Save and reuse templates

- **Send Message**:
  - Select customers (individual, segment, all)
  - Message content (SMS, WhatsApp, Email)
  - Preview message
  - Send now or schedule

- **Communication History**:
  - Sent messages
  - Delivery status
  - Responses

### Right Sidebar/Panels

#### Customer Statistics
- **Customer Metrics**:
  - Total customers
  - Active customers
  - New customers (this month)
  - VIP customers
  - Inactive customers

- **Customer Value**:
  - Average customer lifetime value
  - Top spending customers
  - Customer acquisition cost
  - Retention rate

- **Segmentation**:
  - Customers by tag
  - Customers by segment
  - Customers by location

#### Quick Filters
- **Preset Filters**:
  - New customers
  - VIP customers
  - Active customers
  - Inactive customers
  - High-value customers

- **Custom Filters**:
  - Save custom filter combinations
  - Quick access to saved filters

#### Import/Export
- **Import Options**:
  - CSV template download
  - File upload
  - Import progress
  - Error reporting

- **Export Options**:
  - Export all customers
  - Export filtered customers
  - Export format selection (CSV, Excel)

### Footer
- **Customers Management Footer**:
  - Total customer count
  - Active/Inactive counts
  - Current filter status
  - Quick navigation links

## Technical Requirements

### Functionality
1. **Customer Management Components**:
   - Customer directory table with search and filtering
   - Customer profile view with order history
   - Customer creation/edit form
   - Customer segmentation interface
   - Communication center
   - Import/export functionality (CSV)

2. **Advanced Features**:
   - Customer tagging system
   - Customer segmentation
   - Communication templates
   - Bulk messaging
   - Customer notes and comments
   - Customer metrics and analytics

3. **Communication Tools**:
   - SMS messaging
   - WhatsApp messaging
   - Email messaging
   - Message templates
   - Scheduled messages

4. **Performance**:
   - Pagination for large customer lists
   - Virtual scrolling for customer tables
   - Optimized search indexing
   - Fast customer lookup

### Accessibility
1. **ARIA Attributes**:
   - Proper landmarks for customer sections
   - Keyboard navigation for tables and forms
   - Focus management for modals and dialogs
   - Screen reader support for customer data

2. **Visual Design**:
   - Clear information hierarchy for customer data
   - Color coding for customer status (green=active, gray=inactive)
   - Responsive design for all devices
   - Consistent spacing and layout

3. **Performance**:
   - Fast loading of customer data
   - Efficient filtering and search
   - Real-time communication status
   - Minimal page load times

### Integration
1. **Backend Integration**:
   - Customer CRUD API endpoints
   - Segmentation APIs
   - Communication endpoints
   - Import/export endpoints

2. **Analytics Integration**:
   - Customer analytics
   - Customer lifetime value
   - Retention analysis
   - Segmentation performance

3. **Localization**:
   - Arabic customer management interface
   - Local currency display (SAR/EGP)
   - Regional date and time formats
   - Cultural compliance

## Future-Ready Considerations
1. **Scalability**:
   - Architecture supports unlimited customers
   - Database optimization for large customer databases
   - Caching for frequently accessed customers
   - CDN for customer data

2. **Extensibility**:
   - Plugin system for communication channels
   - Custom field and attribute support
   - Integration framework for CRM systems
   - API-first design for external integrations

3. **Technology Stack Readiness**:
   - Ready for headless commerce
   - Compatible with CRM systems
   - Prepared for AI-powered customer insights
   - Ready for advanced analytics

## Development Notes
1. **Primary Colors**: Use existing application colors (#FF9900, #131921, #FEBD69)
2. **Typography**: Plus Jakarta Sans for headings, Noto Sans Arabic for Arabic text
3. **Iconography**: Material Symbols for all UI elements
4. **Animation**: Subtle transitions for customer actions
5. **Responsive Design**: Desktop-first with mobile supplemental access
6. **Backward Compatibility**: Existing order management flow must continue working

## Documentation Requirements
1. Component documentation for customer management sections
2. API endpoint documentation for customer CRUD operations
3. Segmentation documentation
4. Communication system guides
5. Import/export format specifications

---

*Document created: Google Stitch Prompt for Customers Management*
*Version: 1.0*
*Status: READY FOR DEVELOPMENT*

**Update the existing project. Do NOT redesign existing screens. Do NOT remove components. Do NOT change navigation. Do NOT change business logic. Only create missing UI. Keep identical design language. Keep RTL. Keep responsiveness.**