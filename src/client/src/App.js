import React, { useRef, useState, useMemo, useEffect } from "react";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";

function App() {
  const socketRef = useRef(null);
  const [order, setOrder] = useState(null);
  const isOrderReceived = useMemo(() => {
    return order != null;
  }, [order]);
  console.log(isOrderReceived);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000/ws");
    socket.onopen = () => {
      console.log("WebSocket connection opened");
      socket.send('{"message": "Hello Server!"}');
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    socket.onmessage = (event) => {
      console.log("Message from server:", event.data);
      const payload = JSON.parse(event.data);
      if (payload.recordIds && payload.recordIds.length > 0) {
        // NOTE: 一括更新には未対応
        fetch("/api/orders?recordId=" + payload.recordIds[0])
          .then((response) => response.json())
          .then((data) => {
            setOrder(data.records[0]);
          });
      }
    };

    socketRef.current = socket;

    return () => {
      socket.close();
    };
  }, []);

  const onApprove = () => {
    if (
      !(socketRef.current && socketRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        recordId: order.Id,
        status: "Approved by Manufacturing",
      }),
    );
    setOrder(null);
  };

  return (
    <div className="slds-scope">
      <Header title="E-Biles Manufacturing" />
      <div className="slds-p-around_large">
        <div className="slds-text-heading_large">Orders</div>
        {!isOrderReceived && <EmptyState />}
        {isOrderReceived && (
          <article className="slds-card">
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <a
                      href="#"
                      className="slds-card__header-link slds-truncate"
                      title="Accounts"
                    >
                      <span>Order {order.Name}</span>
                    </a>
                  </h2>
                </div>
              </header>
            </div>
            <div className="slds-media__body">
              <table
                className="slds-table slds-table_cell-buffer slds-table_bordered"
                aria-label="Example default base table of Opportunities"
              >
                <thead>
                  <tr className="slds-line-height_reset">
                    <th className="" scope="col">
                      <div className="slds-truncate" title="Product">
                        Product
                      </div>
                    </th>
                    <th className="" scope="col">
                      <div className="slds-truncate" title="Price">
                        Price
                      </div>
                    </th>
                    <th className="" scope="col">
                      <div className="slds-truncate" title="Qty S">
                        Qty S
                      </div>
                    </th>
                    <th className="" scope="col">
                      <div className="slds-truncate" title="Qty M">
                        Qty M
                      </div>
                    </th>
                    <th className="" scope="col">
                      <div className="slds-truncate" title="Qty L">
                        Qty L
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.Order_Items__r.records.map((orderItem) => (
                    <tr className="slds-hint-parent">
                      <th data-label="Product" scope="row">
                        <div
                          className="slds-truncate"
                          title="{orderItem.Product__r.Name}"
                        >
                          <a href="#" tabindex="-1">
                            {orderItem.Product__r.Name}
                          </a>
                        </div>
                      </th>
                      <td data-label="Price">
                        <div
                          className="slds-truncate"
                          title="${orderItem.Price__c}"
                        >
                          ${orderItem.Price__c}
                        </div>
                      </td>
                      <td data-label="Qty S">
                        <div className="slds-truncate" title="Qty S">
                          2
                        </div>
                      </td>
                      <td data-label="Qty M">
                        <div className="slds-truncate" title="Qty M">
                          3
                        </div>
                      </td>
                      <td data-label="Qty L">
                        <div className="slds-truncate" title="Qty L">
                          5
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="slds-card__footer">
              <button className="slds-button slds-button_destructive">
                Reject
              </button>
              <button
                className="slds-button slds-button_brand"
                onClick={onApprove}
              >
                Approve
              </button>
            </footer>
          </article>
        )}
      </div>
    </div>
  );
}

export default App;
