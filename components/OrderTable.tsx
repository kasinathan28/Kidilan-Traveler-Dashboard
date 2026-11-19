import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { Order, SortConfig, OrderStatus } from "../types";
import { getOrders, updateOrderStatus } from "../api/mockApi";
import { AppContext } from "../contexts/AppContext";
import Pagination from "./Pagination";
import SortableTableHeader from "./SortableTableHeader";
import LoadingSpinner from "./LoadingSpinner";
import { useDebounce } from "../hooks/useDebounce";
import { usePageSize } from "../hooks/usePageSize";
import { ChevronDownIcon } from "./icons";
import ConfirmationModal from "./ConfirmationModal";

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const statusBadgeStyles: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 border-yellow-200 focus:ring-yellow-500",
  processing: "bg-blue-100 text-blue-800 border-blue-200 focus:ring-blue-500",
  shipped:
    "bg-indigo-100 text-indigo-800 border-indigo-200 focus:ring-indigo-500",
  delivered:
    "bg-green-100 text-green-800 border-green-200 focus:ring-green-500",
  cancelled: "bg-red-100 text-red-800 border-red-200 focus:ring-red-500",
};

// ₹1,234.50 (Indian grouping)
const inr = (n: number) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 18 Nov 2026
const shortDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const shortTime = (d: string) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";
// The number the customer sees on their receipt; old orders without one fall back to the internal ID.
// +919876543210 -> +91 98765 43210 (other numbers are shown as entered)
const phoneLabel = (p: string) => {
  const m = /^\+91(\d{5})(\d{5})$/.exec(p.replace(/[\s-]/g, ""));
  return m ? `+91 ${m[1]} ${m[2]}` : p;
};
const orderLabel =(o: Pick<Order, "_id" | "orderNumber">) =>
  o.orderNumber || `#${o._id.slice(-6).toUpperCase()}`;

const OrderTable: React.FC<{ searchQuery: string }> = ({ searchQuery }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalOrders, setTotalOrders] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize("orders");
  const [sortConfig, setSortConfig] = useState<SortConfig<Order>>({
    key: "date",
    direction: "descending",
  });
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showAwbModal, setShowAwbModal] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [newStatusForAwb, setNewStatusForAwb] = useState<OrderStatus | null>(
    null,
  );
  const [awbId, setAwbId] = useState<string>("");
  const [awbIdError, setAwbIdError] = useState<string | null>(null);

  const { showToast } = useContext(AppContext);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Search, sort and rows per page run on the server; any change sends the user back to page 1.
  const filterKey = `${debouncedSearchQuery}|${String(sortConfig.key)}|${sortConfig.direction}|${pageSize}`;
  const lastFilterKey = useRef(filterKey);
  // Only the newest request may update state (page clicks can overlap).
  const requestId = useRef(0);

  const fetchAndSetOrders = useCallback(
    async (pageToFetch: number) => {
      const id = ++requestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getOrders({
          page: pageToFetch,
          limit: pageSize,
          search: debouncedSearchQuery.trim() || undefined,
          sortBy: sortConfig.key,
          sortOrder: sortConfig.direction,
        });
        if (id !== requestId.current) return;
        setOrders(data.orders);
        setTotalOrders(data.totalCount);
        const lastPage = Math.max(Math.ceil(data.totalCount / pageSize), 1);
        if (pageToFetch > lastPage) setCurrentPage(lastPage);
      } catch (err) {
        if (id !== requestId.current) return;
        setError("Failed to fetch orders. Please try again later.");
        showToast("Failed to fetch orders");
      } finally {
        if (id === requestId.current) setIsLoading(false);
      }
    },
    [debouncedSearchQuery, sortConfig, showToast, pageSize],
  );

  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      if (currentPage !== 1) {
        setCurrentPage(1); // re-runs this effect with page 1
        return;
      }
    }
    fetchAndSetOrders(currentPage);
  }, [currentPage, filterKey, fetchAndSetOrders]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    if (newStatus === "shipped") {
      setCurrentOrderId(orderId);
      setNewStatusForAwb(newStatus);
      setShowAwbModal(true);
    } else {
      setUpdatingStatus(orderId);
      try {
        await updateOrderStatus(orderId, newStatus);
        const o = orders.find((x) => x._id === orderId);
        showToast(`Order ${o ? orderLabel(o) : ""} status updated.`);
        setOrders((prev) =>
          prev.map((o) =>
            o._id === orderId ? { ...o, status: newStatus } : o,
          ),
        );
      } catch (err) {
        showToast("Failed to update order status.");
        fetchAndSetOrders(currentPage);
      } finally {
        setUpdatingStatus(null);
      }
    }
  };

  const handleAwbSubmit = async () => {
    if (!currentOrderId || !newStatusForAwb) {
      showToast("Something went wrong. Please try again.");
      return;
    }

    if (!awbId.trim()) {
      setAwbIdError("AWB ID is required.");
      return;
    }

    // Validate AWB ID format (alphanumeric with possible hyphens)
    const awbRegex = /^[A-Za-z0-9-]+$/;
    if (!awbRegex.test(awbId)) {
      setAwbIdError("AWB ID must contain only letters, numbers, and hyphens.");
      return;
    }

    setUpdatingStatus(currentOrderId);
    setShowAwbModal(false);
    try {
      await updateOrderStatus(currentOrderId, newStatusForAwb, awbId.trim());
      const o = orders.find((x) => x._id === currentOrderId);
      showToast(`Order ${o ? orderLabel(o) : ""} status updated and AWB ID added.`);
      setOrders((prev) =>
        prev.map((o) =>
          o._id === currentOrderId ? { ...o, status: newStatusForAwb } : o,
        ),
      );
    } catch (err) {
      showToast("Failed to update order status or add AWB ID.");
      fetchAndSetOrders(currentPage);
    } finally {
      setUpdatingStatus(null);
      setCurrentOrderId(null);
      setNewStatusForAwb(null);
      setAwbId("");
      setAwbIdError(null);
    }
  };

  const handleSort = (key: keyof Order) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const handleToggleExpand = (orderId: string) => {
    setExpandedOrderId((prevId) => (prevId === orderId ? null : orderId));
  };

  const renderTableContent = () => {
    if (isLoading && orders.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-16">
            <LoadingSpinner />
          </td>
        </tr>
      );
    }
    if (error) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-16 text-red-500">
            {error}
          </td>
        </tr>
      );
    }
    const filteredOrders = orders;

    if (filteredOrders.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-16 text-gray-500">
            No orders found.
          </td>
        </tr>
      );
    }
    return filteredOrders.map((order) => (
      <React.Fragment key={order._id}>
        <tr className={`${order.isPreorder ? "bg-purple-50 hover:bg-purple-100 border-purple-200" : "bg-white hover:bg-gray-50"} border-b transition-colors`}>
          <td data-label="Order ID" className="px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleExpand(order._id)}
                className="flex items-center whitespace-nowrap text-[#2D7A79] hover:underline font-mono text-sm group"
              >
                {orderLabel(order)}
                <ChevronDownIcon
                  className={`w-4 h-4 ml-2 transition-transform transform group-hover:text-gray-700 ${expandedOrderId === order._id ? "rotate-180" : ""}`}
                />
              </button>
              {order.isPreorder && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-purple-200 text-purple-800 rounded-full border border-purple-300">
                  Preorder
                </span>
              )}
            </div>
          </td>
          <td data-label="Customer" className="px-6 py-4">
            <div className="font-medium text-gray-900">
              {order.shippingAddress.name}
            </div>
            <div className="text-xs text-gray-500">
              {order.shippingAddress.email}
            </div>
            {order.customerPhone && (
              <a href={`tel:${order.customerPhone}`} className="text-xs text-gray-500 hover:text-[#2D7A79] tabular-nums">
                {phoneLabel(order.customerPhone)}
              </a>
            )}
          </td>
          <td data-label="Date" className="px-6 py-4 whitespace-nowrap">
            <div>{shortDate(order.date)}</div>
            <div className="text-xs text-gray-400">{shortTime(order.date)}</div>
          </td>
          <td data-label="Total" className="px-6 py-4 font-medium tabular-nums whitespace-nowrap">
            {inr(order.totalAmount)}
          </td>
          <td data-label="Status" className="px-6 py-4">
            <div className="flex items-center">
              <select
                value={order.status}
                onChange={(e) =>
                  handleStatusChange(order._id, e.target.value as OrderStatus)
                }
                disabled={updatingStatus === order._id}
                className={`w-32 p-1.5 border rounded-lg text-xs font-medium focus:ring-2 focus:outline-none transition-colors capitalize ${statusBadgeStyles[order.status.toLowerCase()]}`}
              >
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status} className="capitalize">
                    {status}
                  </option>
                ))}
              </select>
              {updatingStatus === order._id && (
                <div className="ml-2 w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
          </td>
          <td data-label="Items" className="px-6 py-4 text-center">
            {order.items.reduce((acc, item) => acc + item.quantity, 0)}
          </td>
        </tr>
        {expandedOrderId === order._id && (
          <tr className={`responsive-table-details ${order.isPreorder ? "bg-purple-50/50 md:bg-purple-50/80" : "bg-gray-50 md:bg-gray-50/50"}`}>
            <td colSpan={6} className="p-0">
              <div className="p-4">
                {/* Shipping Address */}
                <h4 className="font-bold text-gray-700 mb-2">
                  Shipping Address
                </h4>

                <div className="text-sm text-gray-600 mb-4 space-y-1">
                  <div>{order.shippingAddress.street}</div>
                  <div>
                    {order.shippingAddress.city}, {order.shippingAddress.state}
                  </div>
                  <div>{order.shippingAddress.postalCode}</div>
                  <div>{order.shippingAddress.country}</div>
                  {order.customerPhone && (
                    <div>
                      Phone:{" "}
                      <a href={`tel:${order.customerPhone}`} className="text-[#2D7A79] hover:underline tabular-nums">
                        {phoneLabel(order.customerPhone)}
                      </a>
                    </div>
                  )}
                </div>

                {/* Order Items */}
                <h4 className="font-bold text-gray-700 mb-2">Order Items</h4>

                <ul className="space-y-2">
                  {order.items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex flex-col sm:flex-row justify-between sm:items-center text-sm p-3 rounded-md bg-white border border-gray-200 shadow-sm"
                    >
                      <div>
                        <span className="font-semibold text-gray-800">
                          {item.productName || `Product ID: ${item.productId}`}
                        </span>
                        {item.variantLabel && (
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {item.variantLabel}
                          </span>
                        )}
                      </div>

                      <div className="text-left sm:text-right mt-2 sm:mt-0">
                        <div className="text-gray-600">
                          Qty: {item.quantity}
                        </div>
                        <div className="text-gray-800 font-medium tabular-nums">
                          {inr(item.price)} each
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 text-sm text-gray-600 sm:text-right tabular-nums">
                  <div>Delivery: {order.deliveryFee ? inr(order.deliveryFee) : "Free"}</div>
                  <div className="font-semibold text-gray-800">Total: {inr(order.totalAmount)}</div>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    ));
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-800">Customer Orders</h3>
      </div>
      <div className="overflow-x-auto responsive-table">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <SortableTableHeader<Order>
                label="Order No."
                sortKey="orderNumber"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHeader<Order>
                label="Customer"
                sortKey="customerName"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHeader<Order>
                label="Date"
                sortKey="date"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHeader<Order>
                label="Total"
                sortKey="totalAmount"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <SortableTableHeader<Order>
                label="Status"
                sortKey="status"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
              <th scope="col" className="px-6 py-3 text-center">
                Items
              </th>
            </tr>
          </thead>
          <tbody>{renderTableContent()}</tbody>
        </table>
      </div>

      {!isLoading && !error && orders.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalCount={totalOrders}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onPageChange={(page) => setCurrentPage(page)}
        />
      )}

      <ConfirmationModal
        isOpen={showAwbModal}
        onClose={() => {
          setShowAwbModal(false);
          setAwbId("");
          setCurrentOrderId(null);
          setNewStatusForAwb(null);
          setAwbIdError(null);
        }}
        onConfirm={handleAwbSubmit}
        title="Enter AWB ID"
        message="Please enter the Air Waybill (AWB) ID for this shipment."
        variant="primary"
      >
        <div>
          <input
            type="text"
            value={awbId}
            onChange={(e) => {
              setAwbId(e.target.value);
              if (awbIdError) setAwbIdError(null);
            }}
            placeholder="Enter AWB ID (e.g., ABC-12345678)"
            className={`w-full p-3 border ${awbIdError ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-[#2D7A79]"} rounded-lg focus:ring-2 focus:outline-none`}
            pattern="[A-Za-z0-9-]+"
            required
            autoFocus
            onBlur={(e) => e.target.focus()}
          />
          {awbIdError && (
            <p className="text-red-600 text-sm mt-1">{awbIdError}</p>
          )}
        </div>
      </ConfirmationModal>
    </div>
  );
};

export default OrderTable;
