# Orders Management - Google Stitch Prompt

## Project Goal
Create the Orders Management interface for processing, tracking, and managing customer orders. This extends the existing order management functionality with enhanced filtering, status tracking, fulfillment management, and analytics.

## Design Style
- **Operational Focus** - Tools for managing daily order operations
- **Status-Centric Design** - Clear emphasis on order status and lifecycle
- **Multi-Tenant Support** - Tenant-specific order management
- **Arabic RTL Support** - Full RTL interface with Saudi/Egyptian market features
- **Role-Based Access** - Interface customized based on user role within tenant
- **Responsive Design** - Comprehensive desktop interface with mobile supplemental access
- **Performance-Oriented** - Fast access to order data and bulk operations

## Layout Structure

### Header & Context
- **Orders Management Title**:
  - "إدارة الطلبات" (Orders Management)
  - Current order count and status breakdown
  - Quick access to export and reporting functions
  - Search bar for order lookup

- **Action Bar**:
  - "تصدير الطلبات" (Export Orders) - Export current list
  - "تحديث الحالة" (Update Status) - Bulk status update
  - "طباعة الطلبات" (Print Orders) - Print selected orders
  - "إرسال تذييل" (Send Notification) - Send status updates

### Main Content Area

#### Order List Table
- **Columns**: Order Number, Customer Name, Phone, Total Amount, Status, Items Count, Created Date, Actions
- **Search and Filter**:
  - Search by order number, customer name, phone
  - Filter by status (new, contacted, processing, shipped, delivered, cancelled, returned)
  - Filter by date range
  - Filter by amount range
  - Filter by governorate/city
- **Sorting**: Sort by order number, date, amount, status
- **Bulk Actions**:
  - Update status (bulk)
  - Delete orders
  - Export selected orders
  - Send notifications
- **Status Badges**: Color-coded status indicators
- **Pagination**: 10/25/50/100 per page

#### Order Detail View
- **Order Information**:
  - Order number and status
  - Customer details (name, phone, address)
  - Order total and payment status
  - Created date and last updated
  - Order notes

- **Order Items**:
  - Product name, variant (color/size), quantity, unit price
  - Item subtotal
  - Product images
  - Product links

- **Status Timeline**:
  - Visual timeline of order status changes
  - Status change history
  - User who made changes
  - Timestamps

- **Status Management**:
  - Status dropdown with all available statuses
  - Status change notes
  - Notification toggle (email/SMS to customer)

- **Actions**:
  - Edit order details
  - Update status
  - Add note
  - Send notification
  - Print order
  - Delete order

#### Order Creation/Edit
- **Customer Information**:
  - Customer name
  - Phone number
  - Address (governorate, city, detailed address)
  - Notes

- **Order Items**:
  - Product selection
  - Variant selection (color, size)
  - Quantity
  - Unit price
  - Add/remove items

- **Order Summary**:
  - Subtotal
  - Shipping cost
  - Discount
  - Total amount

- **Status**:
  - Initial status selection
  - Status notes

#### Fulfillment Management
- **Shipping Information**:
  - Shipping carrier
  - Tracking number
  - Estimated delivery date
  - Shipping notes

- **Delivery Management**:
  - Delivery assignment
  - Delivery notes
  - Proof of delivery

### Right Sidebar/Panels

#### Order Statistics
- **Status Distribution**:
  - Count per status
  - Percentage breakdown
  - Visual chart

- **Revenue Metrics**:
  - Total revenue
  - Revenue by status
  - Average order value
  - Daily/weekly/monthly trends

- **Recent Orders**:
  - Latest orders
  - Quick status updates

#### Quick Filters
- **Preset Filters**:
  - Today's orders
  - New orders
  - Processing orders
  - Shipped orders
  - Delivered orders
  - Cancelled orders

- **Custom Filters**:
  - Save custom filter combinations
  - Quick access to saved filters

#### Export Options
- **Export Formats**:
  - CSV
  - Excel
  - PDF

- **Export Scope**:
  - Current page
  - Filtered results
  - All orders

### Footer
- **Orders Management Footer**:
  - Total order count
  - Status breakdown
  - Current filter status
  - Quick navigation links

## Technical Requirements

### Functionality
1. **Order Management Components**:
   - Order list table with search and filtering
   - Order detail view with status timeline
   - Status management interface
   - Order creation/edit form
   - Fulfillment management
   - Bulk operations (status update, delete, export)

2. **Advanced Features**:
   - Status change history
   - Customer notification system
   - Print order functionality
   - Order notes and comments
   - Delivery tracking integration

3. **Analytics**:
   - Order status distribution
   - Revenue tracking
   - Average order value
   - Daily/weekly/monthly trends

4. **Performance**:
   - Pagination for large order lists
   - Virtual scrolling for order tables
   - Optimized search indexing
   - Fast status updates

### Accessibility
1. **ARIA Attributes**:
   - Proper landmarks for order sections
   - Keyboard navigation for tables and forms
   - Focus management for modals and dialogs
   - Screen reader support for order data

2. **Visual Design**:
   - Color coding for order status (blue=new, orange=processing, green=delivered, red=cancelled)
   - Clear information hierarchy for order data
   - Responsive design for all devices
   - Consistent spacing and layout

3. **Performance**:
   - Fast loading of order data
   - Efficient filtering and search
   - Real-time status updates
   - Minimal page load times

### Integration
1. **Backend Integration**:
   - Order CRUD API endpoints
   - Status update endpoints
   - Export endpoints
   - Notification endpoints

2. **Analytics Integration**:
   - Order analytics
   - Revenue tracking
   - Customer behavior analysis
   - Trend identification

3. **Localization**:
   - Arabic order management interface
   - Local currency display (SAR/EGP)
   - Regional date and time formats
   - Cultural compliance

## Future-Ready Considerations
1. **Scalability**:
   - Architecture supports unlimited orders
   - Database optimization for large order volumes
   - Caching for frequently accessed orders
   - CDN for order documents

2. **Extensibility**:
   - Plugin system for order types
   - Custom field and attribute support
   - Integration framework for shipping providers
   - API-first design for external integrations

3. **Technology Stack Readiness**:
   - Ready for headless commerce
   - Compatible with ERP systems
   - Prepared for AI-powered order routing
   - Ready for advanced analytics

## Development Notes
1. **Primary Colors**: Use existing application colors (#FF9900, #131921, #FEBD69)
2. **Typography**: Plus Jakarta Sans for headings, Noto Sans Arabic for Arabic text
3. **Iconography**: Material Symbols for all UI elements
4. **Animation**: Subtle transitions for order status changes
5. **Responsive Design**: Desktop-first with mobile supplemental access
6. **Backward Compatibility**: Existing order management flow must continue working

## Documentation Requirements
1. Component documentation for order management sections
2. API endpoint documentation for order CRUD operations
3. Status workflow documentation
4. Export format specifications
5. Notification system guides

---

*Document created: Google Stitch Prompt for Orders Management*
*Version: 1.0*
*Status: READY FOR DEVELOPMENT*

**Update the existing project. Do NOT redesign existing screens. Do NOT remove components. Do NOT change navigation. Do NOT change business logic. Only create missing UI. Keep identical design language. Keep RTL. Keep responsiveness.**