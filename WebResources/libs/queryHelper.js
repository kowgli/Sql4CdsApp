"use strict";
var XRM;
(function (XRM) {
    var Libs;
    (function (Libs) {
        class QueryHelper {
            static valueOrDefault(attr, defaultValue = null) {
                return attr ? attr : defaultValue;
            }
            static nullableNumberToString(nr) {
                if (!nr) {
                    return "";
                }
                else
                    return nr.toString();
            }
            static nullableStringToString(str) {
                if (!str) {
                    return "";
                }
                else
                    return str;
            }
            static nullableStringToNumber(str) {
                if (!str) {
                    return null;
                }
                else
                    return parseInt(str);
            }
            static jsonDateToDateString(dateStr) {
                if (!dateStr) {
                    return "";
                }
                // Sample value: "/Date(1584023400000)/"
                try {
                    dateStr = dateStr.replace(/\D/g, '');
                    let date = new Date(parseInt(dateStr));
                    return date.toLocaleDateString();
                }
                catch (err) {
                    return "";
                }
            }
            static ensureResponse(result, callback) {
                if (!result || !callback) {
                    return;
                }
                if (result.responseText) {
                    callback(JSON.parse(result.responseText));
                }
                result.json().then((response) => {
                    callback(response);
                });
            }
            static async ensureResponseAsync(result) {
                if (!result) {
                    return null;
                }
                if (result.responseText) {
                    return JSON.parse(result.responseText);
                }
                return result.json();
            }
            static async callGenericActionAsync(type, request) {
                let action = {
                    Type: type,
                    Request: request,
                    getMetadata: function () {
                        return {
                            boundParameter: null,
                            parameterTypes: {
                                "Type": {
                                    "typeName": "Edm.String",
                                    "structuralProperty": 1
                                },
                                "Request": {
                                    "typeName": "Edm.String",
                                    "structuralProperty": 1
                                }
                            },
                            operationType: 0,
                            operationName: "mm365_GenericAction"
                        };
                    }
                };
                let result = await Xrm.WebApi.online.execute(action);
                if (result.ok) {
                    let response = await this.ensureResponseAsync(result);
                    return response.Response;
                }
                return null;
            }
            static callGenericAction(type, request, callback) {
                let action = {
                    Type: type,
                    Request: request,
                    getMetadata: function () {
                        return {
                            boundParameter: null,
                            parameterTypes: {
                                "Type": {
                                    "typeName": "Edm.String",
                                    "structuralProperty": 1
                                },
                                "Request": {
                                    "typeName": "Edm.String",
                                    "structuralProperty": 1
                                }
                            },
                            operationType: 0,
                            operationName: "dss_GenericAction"
                        };
                    }
                };
                Xrm.WebApi.online.execute(action).then((result) => {
                    if (result.ok) {
                        XRM.Libs.QueryHelper.ensureResponse(result, (response) => {
                            callback(response.Response);
                        });
                    }
                }, (error) => {
                    Xrm.Navigation.openAlertDialog({ text: error.message });
                });
            }
        }
        Libs.QueryHelper = QueryHelper;
    })(Libs = XRM.Libs || (XRM.Libs = {}));
})(XRM || (XRM = {}));
//# sourceMappingURL=queryHelper.js.map